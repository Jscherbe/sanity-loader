/**
 * @module @ulu/sanity-loader
 * @version 1.0.0
 * @description
 * A generic loader for Sanity content. It handles data fetching, caching, and asset management.
 */

import fs from "fs-extra";
import https from "https";
import path from "path";
import { createClient } from "@sanity/client";
import createImageUrl from "@sanity/image-url";
import { fixPortableText } from "./utils.js";

/**
 * @typedef {import('@sanity/client').SanityClient} SanityClient
 * @typedef {import('@sanity/image-url/lib/types/builder').ImageUrlBuilder} ImageUrlBuilder
 */

/**
 * Default options for a loader
 * @private
 */
const loaderDefaults = {
  queryName: null,
  query: null,
  transform: null,
  cacheEnabled: true,
  expectedVersion: null
};

/**
 * @typedef {object} SanityLoader
 * @property {SanityClient} client - The configured Sanity client instance.
 * @property {(options: object) => () => Promise<any>} defineLoader - Defines a data loader for a specific query.
 * @property {(source: object) => ImageUrlBuilder} imageUrl - The Sanity image URL builder instance.
 * @property {{ fixPortableText: (...fields: Array<object>[]) => void, saveAsset: (url: string) => Promise<string | null> }} utils - Utility functions.
 */

/**
 * Creates the main Sanity Loader instance.
 * @param {object} config - The configuration object.
 * @returns {SanityLoader} The Sanity Loader instance.
 */
export function createSanityLoader(config) {
  const defaultSettings = {
    autoCacheInvalidation: true,
    verbose: false,
    client: null,
    sanity: null,
    paths: {},
  };

  const settings = { ...defaultSettings, ...config };

  const { 
    client: clientInstance, 
    sanity: sanityConfig, 
    paths: pathConfig, 
    autoCacheInvalidation, 
    verbose 
  } = settings;

  if ((!clientInstance && !sanityConfig) || !pathConfig) {
    throw new Error("Configuration requires `paths` and either a `client` instance or a `sanity` config property.");
  }

  const cacheDir = pathConfig.cache || path.join(process.cwd(), "node_modules", ".@ulu-cache-vite-virtual-modules-sanity-loader");

  const client = clientInstance || createClient(sanityConfig);
  const imageUrlBuilder = createImageUrl(client);

  let contentFreshness = {
    checked: false,
    isStale: true,
    timestamp: null
  };

  /**
   * Checks for content changes in Sanity by comparing the latest `_updatedAt` timestamp.
   * This function runs once per build and updates a timestamp file if changes are detected.
   * @returns {Promise<boolean>} A promise that resolves to `true` if content is stale, `false` otherwise.
   */
  async function checkContentFreshness() {
    if (!autoCacheInvalidation) {
      contentFreshness.checked = true;
      contentFreshness.isStale = true; // Always treat as stale if automatic check is off
      return true;
    }

    const timestampFile = path.join(cacheDir, "latest-update.txt");
    const cachedTimestamp = fs.existsSync(timestampFile) ? fs.readFileSync(timestampFile).toString() : null;
    
    const liveTimestamp = await client.fetch("* | order(_updatedAt desc)[0]._updatedAt");

    contentFreshness.timestamp = liveTimestamp;
    const isStale = liveTimestamp !== cachedTimestamp;

    if (isStale) {
      if (verbose) console.log("Sanity content has changed, invalidating cache.");
      try {
        fs.ensureDirSync(path.dirname(timestampFile));
        fs.writeFileSync(timestampFile, liveTimestamp);
      } catch (err) {
        console.error("Could not write timestamp file.", err);
      }
    } else {
      if (verbose) console.log("Sanity content is fresh, using cache.");
    }
    
    contentFreshness.isStale = isStale;
    contentFreshness.checked = true;
    return isStale;
  }

  /**
   * Executes a GROQ query against the Sanity API.
   * @param {string} query - The GROQ query to execute.
   * @returns {Promise<any>} A promise that resolves with the query result.
   */
  async function fetch(query) {
    if (!query) {
      throw new Error("API: Incorrect query passed to fetch");
    }
    return client.fetch(query);
  }

  /**
   * Reads a .groq query from the filesystem.
   * @param {string} queryName - The name of the query file (without extension).
   * @returns {string} The content of the query file.
   * @throws {Error} If the query file cannot be found.
   */
  function getQuery(queryName) {
    if (!queryName) {
      throw new Error("API: getQuery requires a queryName");
    }
    const filepath = path.join(pathConfig.queries, `${queryName}.groq`);
    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath).toString();
    } else {
      throw new Error(`API: Unable to get query file ${queryName} at ${filepath}`);
    }
  }

  /**
   * Gets the full filesystem path for a cached query result.
   * @param {string} queryName - The name of the query.
   * @returns {string} The absolute path to the cache file.
   */
  function getCacheFilepath(queryName) {
    return path.join(cacheDir, `${queryName}.json`);
  }

  /**
   * Writes a query result to the cache.
   * @param {any} result - The result from the Sanity fetch.
   * @param {string} queryName - The name of the query to cache.
   * @param {string} [expectedVersion] - The cache version.
   */
  function cacheResult(result, queryName, expectedVersion) {
    const data = { result, version: expectedVersion };
    const filepath = getCacheFilepath(queryName);
    try {
      fs.ensureDirSync(path.dirname(filepath));
      fs.writeFileSync(filepath, JSON.stringify(data));
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Loads a query result from the cache if it exists and the version matches.
   * @param {string} queryName - The name of the query to load.
   * @param {string} [expectedVersion] - The expected cache version.
   * @returns {any|null} The cached result, or null if not found or version mismatch.
   */
  function loadFromCache(queryName, expectedVersion) {
    const filepath = getCacheFilepath(queryName);
    if (fs.existsSync(filepath)) {
      const file = fs.readFileSync(filepath);
      try {
        const { result, version } = JSON.parse(file.toString());
        // If using manual versioning, it's the only thing that matters.
        if (expectedVersion) {
          return version === expectedVersion ? result : null;
        }
        // If in automatic mode, the global freshness check has already happened.
        // If content is not stale, we can trust the cache.
        if (autoCacheInvalidation && !contentFreshness.isStale) {
          return result;
        }
      } catch (err) {
        console.error(err);
      }
    }
    return null;
  }

  /**
   * Downloads an asset from a URL, saves it locally, and returns the public path.
   * Avoids re-downloading if the file already exists.
   * @param {string} url - The URL of the asset to download.
   * @returns {Promise<string|null>} A promise that resolves with the public path of the saved asset, or null if the URL is empty.
   */
  async function saveAsset(url) {
    if (!url) return null;

    await fs.ensureDir(pathConfig.assetsFs);

    const imageName = path.basename(new URL(url).pathname);
    const localPath = path.join(pathConfig.assetsFs, imageName);
    const publicPath = `${pathConfig.assetsPublic}/${imageName}`;

    if (await fs.pathExists(localPath)) {
      return publicPath;
    }

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(localPath);
      https.get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          if (verbose) console.log(`Downloaded ${imageName}`);
          resolve(publicPath);
        });
      }).on("error", (err) => {
        fs.unlink(localPath, () => reject(err));
        console.error(`Error downloading ${imageName}: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Defines a loader for a specific query, handling caching, fetching, and transformation.
   * @param {object} options - The loader options.
   * @returns {() => Promise<any>} An async function that executes the loader and returns the transformed data.
   */
  function defineLoader(options) {
    const loaderConfig = { ...loaderDefaults, ...options };
    const { query, queryName, transform, cacheEnabled, expectedVersion } = loaderConfig;

    return async function run() {
      try {
        if (cacheEnabled && !queryName) {
          throw new Error("defineLoader: `queryName` is required for caching.");
        }

        if (!contentFreshness.checked) {
          await checkContentFreshness();
        }

        let result;
        const cache = cacheEnabled ? loadFromCache(queryName, expectedVersion) : null;

        if (cache) {
          if (verbose) console.warn(`Loaded query (${queryName}) data from cache`);
          result = cache;
        } else {
          const queryString = query || (queryName ? getQuery(queryName) : null);
          if (!queryString) {
            throw new Error("defineLoader: `query` or `queryName` must be provided.");
          }
          if (verbose) console.log(`Fetching fresh data for query (${queryName})`);
          result = await fetch(queryString);
          if (cacheEnabled) {
            cacheResult(result, queryName, expectedVersion);
          }
        }

        return transform ? await transform(result) : result;

      } catch (error) {
        console.error(queryName, error.toString());
        throw error;
      }
    };
  }

  return {
    client,
    defineLoader,
    imageUrl: (source) => imageUrlBuilder.image(source),
    utils: {
      fixPortableText,
      saveAsset
    }
  };
}
