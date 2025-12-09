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
import { loaderDefaults, defaultSanityLoaderOptions } from "./defaults.js";
import { log } from "./logger.js";

/**
 * @typedef {import('@sanity/client').SanityClient} SanityClient
 * @typedef {import('@sanity/image-url/lib/types/builder').ImageUrlBuilder} ImageUrlBuilder
 */

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
  const settings = { ...defaultSanityLoaderOptions, ...config };

  const { 
    client: clientInstance, 
    clientConfig, 
    paths: pathConfig, 
    verbose,
    invalidateCachePerCall
  } = settings;

  const isCacheStaleFn = settings.isCacheStale || defaultSanityLoaderOptions.isCacheStale;

  if ((!clientInstance && !clientConfig) || !pathConfig) {
    throw new Error("Configuration requires `paths` and either a `client` instance or a `clientConfig` object.");
  }

  const cacheDir = pathConfig.cache || path.join(process.cwd(), "node_modules", ".@ulu-cache-vite-virtual-modules-sanity-loader");

  const client = clientInstance || createClient(clientConfig);
  const imageUrlBuilder = createImageUrl(client);

  let onStartStaleState = null; // null | boolean
  let onStartCheckPromise = null;

  async function getStaleState() {
    if (invalidateCachePerCall) {
      return Promise.resolve(isCacheStaleFn(client, { cacheDir }));
    }

    // "on-start" logic (default)
    if (onStartStaleState !== null) {
      return onStartStaleState;
    }

    if (onStartCheckPromise) {
      return onStartCheckPromise;
    }

    onStartCheckPromise = Promise.resolve(isCacheStaleFn(client, { cacheDir })).then(isStale => {
      onStartStaleState = isStale;
      onStartCheckPromise = null;
      return isStale;
    });

    return onStartCheckPromise;
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
   * @param {string} query - The GROQ query string.
   */
  function cacheResult(result, queryName, expectedVersion, query) {
    const data = { result, version: expectedVersion, query };
    const filepath = getCacheFilepath(queryName);
    try {
      fs.ensureDirSync(path.dirname(filepath));
      fs.writeFileSync(filepath, JSON.stringify(data));
    } catch (err) {
      log.error(err);
    }
  }

  /**
   * Loads a query result from the cache if it exists and the version matches.
   * @param {string} queryName - The name of the query to load.
   * @param {string} [expectedVersion] - The expected cache version.
   * @param {boolean} isStale - Whether the cache is considered stale.
   * @param {string} currentQuery - The current GROQ query string.
   * @returns {any|null} The cached result, or null if not found or version mismatch.
   */
  function loadFromCache(queryName, expectedVersion, isStale, currentQuery) {
    const filepath = getCacheFilepath(queryName);
    if (fs.existsSync(filepath)) {
      // If content is stale, don't even bother reading the file.
      if (isStale) return null;

      const file = fs.readFileSync(filepath);
      try {
        const { result, version, query: cachedQuery } = JSON.parse(file.toString());
        // If the query has changed, invalidate the cache.
        if (currentQuery !== cachedQuery) {
          return null;
        }
        // If using manual versioning, it's the only thing that matters.
        if (expectedVersion) {
          return version === expectedVersion ? result : null;
        }
        // If not stale and not manually versioned, we can trust the cache.
        return result;
      } catch (err) {
        log.error(err);
      }
    }
    return null;
  }

  /**
   * Downloads an asset from a URL, saves it locally, and returns the public path.
   * @param {string} url - The URL of the asset to download.
   * @returns {Promise<string|null>} A promise that resolves with the public path of the saved asset.
   */
  async function saveAsset(url) {
    if (!url) return null;

    await fs.ensureDir(pathConfig.assets);

    const imageName = path.basename(new URL(url).pathname);
    const localPath = path.join(pathConfig.assets, imageName);
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
          if (verbose) log.log(`Downloaded ${imageName}`);
          resolve(publicPath);
        });
      }).on("error", (err) => {
        fs.unlink(localPath, () => reject(err));
        log.error(`Error downloading ${imageName}: ${err.message}`);
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

        let isStale = true;
        if (cacheEnabled) {
          isStale = await getStaleState();
          if (isStale && verbose) {
            log.log(`Cache is stale for query (${queryName})`);
          }
        }
        
        let result;

        const queryString = query || (queryName ? getQuery(queryName) : null);
        if (!queryString) {
          throw new Error("defineLoader: `query` or `queryName` must be provided.");
        }

        const cache = cacheEnabled ? loadFromCache(queryName, expectedVersion, isStale, queryString) : null;

        if (cache) {
          log.log(`Loaded query (${queryName}) data from cache`);
          result = cache;
        } else {
          log.log(`Fetching fresh data for query (${queryName})`);
          result = await fetch(queryString);
          if (cacheEnabled) {
            cacheResult(result, queryName, expectedVersion, queryString);
          }
        }

        return transform ? await transform(result) : result;

      } catch (error) {
        log.error(queryName, error.toString());
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
    },
    config: settings
  };
}
