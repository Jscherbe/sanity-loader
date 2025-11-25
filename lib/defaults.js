/**
 * @module @ulu/sanity-loader/defaults
 * @version 1.0.0
 * @description
 * Default options for the Sanity Loader.
 */

import fs from "fs-extra";
import path from "path";
import { log } from "./logger.js";

/**
 * @typedef {import('@sanity/client').SanityClient} SanityClient
 */

export const loaderDefaults = {
  queryName: null,
  query: null,
  transform: null,
  cacheEnabled: true,
  expectedVersion: null,
};

/**
 * The default cache invalidation strategy.
 * It compares the timestamp of the most recently updated document in Sanity
 * with a locally cached timestamp.
 * @param {SanityClient} client - The Sanity client instance.
 * @param {{cacheDir: string}} context - The context object.
 * @returns {Promise<boolean>} A promise that resolves to true if the cache is stale.
 */
async function isCacheStale(client, { cacheDir }) {
  log.log("Checking if cache is stale...");
  const timestampFile = path.join(cacheDir, "latest-update.txt");
  const cachedTimestamp = fs.existsSync(timestampFile) ? fs.readFileSync(timestampFile).toString() : null;
    
  const liveTimestamp = await client.fetch("* | order(_updatedAt desc)[0]._updatedAt");
  const isStale = !liveTimestamp || liveTimestamp !== cachedTimestamp;

  if (isStale && liveTimestamp) {
    fs.ensureDirSync(path.dirname(timestampFile));
    fs.writeFileSync(timestampFile, liveTimestamp);
  }
    
  return isStale;
}

export const defaultSanityLoaderOptions = {
  verbose: false,
  client: null,
  clientConfig: null,
  paths: {},
  isCacheStale,
  invalidateCachePerCall: false
};
