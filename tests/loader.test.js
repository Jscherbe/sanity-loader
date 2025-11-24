import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { createSanityLoader } from '../lib/index.js';
import { createSanityClient } from "./utils.js";

const paths = {
  cache: './tests/.cache',
  queries: './tests/queries',
  assetsFs: './tests/assets',
  assetsPublic: '/assets',
};

const queryName = 'posts';
const cacheDir = paths.cache;
const cacheFile = path.join(cacheDir, `${queryName}.json`);
const timestampFile = path.join(cacheDir, 'latest-update.txt');

let sanityLoader;

// --- Setup ---
beforeAll(() => {
  if (!sanityConfig.projectId || !sanityConfig.dataset || !sanityConfig.token) {
    throw new Error('Sanity credentials must be defined in your .env file.');
  }
  const sanityClient = createSanityClient();
  sanityLoader = createSanityLoader({
    client: sanityClient,
    paths: paths,
    verbose: false,
  });
});

// --- Cleanup ---
afterEach(async () => {
  // Clean up cache directory after each test
  await fs.rm(cacheDir, { recursive: true, force: true });
});


// --- Tests ---
describe('Sanity Loader Core Mechanics', () => {

  it('should fetch data on the first run and create a cache file', async () => {
    const fetchPosts = sanityLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    const posts = await fetchPosts();

    // Behavior check: Did it return the right number of items?
    expect(posts).toBeInstanceOf(Array);
    expect(posts).toHaveLength(3);

    // Behavior check: Did it create a cache file?
    const cacheFileStat = await fs.stat(cacheFile).catch(() => null);
    expect(cacheFileStat).not.toBeNull();
    expect(cacheFileStat.isFile()).toBe(true);
  });


  it('should serve data from cache on the second run', async () => {
    const fetchPosts = sanityLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    // Run 1: Establish the cache
    await fetchPosts();
    const cacheStats1 = await fs.stat(cacheFile);

    // Wait a moment to ensure file modification times would be different if written
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Run 2: Should be a cache hit
    await fetchPosts();
    const cacheStats2 = await fs.stat(cacheFile);
    
    // Behavior check: Was the cache file re-written? It shouldn't have been.
    expect(cacheStats2.mtimeMs).toBe(cacheStats1.mtimeMs);
  });


  it('should re-run freshness check when timestamp is missing', async () => {
    const fetchPosts = sanityLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    // Run 1: Establish cache and timestamp
    await fetchPosts();
    const timestampStat1 = await fs.stat(timestampFile).catch(() => null);
    expect(timestampStat1).not.toBeNull();

    // Delete the timestamp to simulate a stale state
    await fs.rm(timestampFile);
    
    // Wait a moment to ensure clock ticks
    await new Promise(resolve => setTimeout(resolve, 50));

    // Run 2: Should re-run the check and re-create the file
    await fetchPosts();
    const timestampStat2 = await fs.stat(timestampFile).catch(() => null);

    // Behavior check: Was the timestamp file re-created?
    expect(timestampStat2).not.toBeNull();
    // Its creation time should be later than the first one.
    expect(timestampStat2.birthtimeMs).toBeGreaterThan(timestampStat1.birthtimeMs);
  });

});
