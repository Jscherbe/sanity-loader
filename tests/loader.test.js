import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs/promises";
import { createSanityLoader } from "../lib/index.js";
import { createSanityClient } from "./utils.js";

const paths = {
  cache: "./tests/.cache",
  queries: "./tests/queries",
  assets: "./tests/assets",
  assetsPublic: "/assets",
};

const queryName = "posts";
const cacheDir = paths.cache;
const cacheFile = path.join(cacheDir, `${ queryName }.json`);
const timestampFile = path.join(cacheDir, "latest-update.txt");

let sanityLoader;

// --- Setup ---
beforeAll(() => {
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
describe("Sanity Loader Core Mechanics", () => {

  it("should fetch data on the first run and create a cache file", async () => {
    const fetchPosts = sanityLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    const posts = await fetchPosts();

    // Behavior check: Did it return the right number of items?
    expect(posts).toBeInstanceOf(Array);
    expect(posts.length).toBeGreaterThan(0);

    // Behavior check: Did it create a cache file?
    const cacheFileStat = await fs.stat(cacheFile).catch(() => null);
    expect(cacheFileStat).not.toBeNull();
    expect(cacheFileStat.isFile()).toBe(true);
  });


  it("should serve data from cache on the second run", async () => {
    const sanityClient = createSanityClient();
    const nonStaleLoader = createSanityLoader({
      client: sanityClient,
      paths: paths,
      isCacheStale: () => false, // Critically, we tell it the cache is always fresh.
    });

    const fetchPosts = nonStaleLoader.defineLoader({
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
    
    // Behavior check: Was the cache file re-written? It shouldn"t have been.
    expect(cacheStats2.mtimeMs).toBe(cacheStats1.mtimeMs);
  });


  it("should invalidate cache and re-fetch when content is stale", async () => {
    const fetchPosts = sanityLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    // Run 1: Establish cache, get its modification time.
    await fetchPosts();
    const cacheStats1 = await fs.stat(cacheFile);

    // Manually write an old timestamp to simulate a stale cache
    await fs.writeFile(timestampFile, "2024-01-01T00:00:00.000Z");
    
    // Wait a moment to ensure file modification times would be different if written
    await new Promise(resolve => setTimeout(resolve, 50));

    // Run 2: This should detect the stale timestamp and re-fetch.
    await fetchPosts();
    const cacheStats2 = await fs.stat(cacheFile);

    // Behavior check: Was the cache file re-written? It should have been.
    expect(cacheStats2.mtimeMs).toBeGreaterThan(cacheStats1.mtimeMs);
  });


  it("should use custom invalidation function when provided", async () => {
    // This function will say the cache is fresh the first time, and stale the second time.
    const createStaleOnSecondCall = () => {
      let callCount = 0;
      return async (_client, _context) => {
        callCount++;
        return callCount > 1;
      };
    };

    const customIsCacheStale = createStaleOnSecondCall();
    const sanityClient = createSanityClient();
    const customLoader = createSanityLoader({
      client: sanityClient,
      paths: paths,
      isCacheStale: customIsCacheStale, // Use the custom function
      invalidateCachePerCall: true, // This test requires per-call behavior
    });
    
    const fetchPosts = customLoader.defineLoader({
      queryName: queryName,
      cacheEnabled: true,
    });
    
    // Run 1: Establish cache. Custom `isStale` returns false.
    await fetchPosts();
    const cacheStats1 = await fs.stat(cacheFile);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Run 2: Custom `isStale` returns true. Should re-fetch.
    await fetchPosts();
    const cacheStats2 = await fs.stat(cacheFile);

    // Behavior check: Was the cache file re-written? It should have been.
    expect(cacheStats2.mtimeMs).toBeGreaterThan(cacheStats1.mtimeMs);
  });

  it("should invalidate cache when the query changes", async () => {
    // This test ensures that changing the GROQ query string invalidates the
    // cache, even if the `queryName` remains the same. We use two queries
    // with guaranteed different result structures to verify this.

    const cacheTestName = "query-change-test";
    const cacheFilepath = path.join(cacheDir, `${cacheTestName}.json`);

    // Loader 1 uses a query that returns a simple string (the current timestamp).
    const query1 = "now()";
    const loader1 = sanityLoader.defineLoader({
      queryName: cacheTestName,
      query: query1,
      cacheEnabled: true,
    });

    // Run 1: Establish the cache with the result of the first query.
    const result1 = await loader1();
    const cacheStats1 = await fs.stat(cacheFilepath);
    const cacheContent1 = JSON.parse(await fs.readFile(cacheFilepath, "utf-8"));
    
    // Verify the first query and its string result were cached.
    expect(cacheContent1.query).toBe(query1);
    expect(typeof result1).toBe("string");

    // Wait a moment to ensure file modification times would be different.
    await new Promise(resolve => setTimeout(resolve, 50));

    // Loader 2 uses the same `queryName` but a different query that returns an array.
    const query2 = "*[_type == 'post']";
    const loader2 = sanityLoader.defineLoader({
      queryName: cacheTestName,
      query: query2,
      cacheEnabled: true,
    });

    // Run 2: This should be a cache miss because the query string is different.
    const result2 = await loader2();
    const cacheStats2 = await fs.stat(cacheFilepath);

    // Behavior check: The cache file should have been re-written.
    expect(cacheStats2.mtimeMs).toBeGreaterThan(cacheStats1.mtimeMs);

    // Behavior check: The new cache file should contain the second query.
    const cacheContent2 = JSON.parse(await fs.readFile(cacheFilepath, "utf-8"));
    expect(cacheContent2.query).toBe(query2);

    // Behavior check: The second result should be an array, which is fundamentally
    // different from the first result (a string).
    expect(Array.isArray(result2)).toBe(true);
  });

});

describe("Cache Invalidation Strategy", () => {

  it("should check for stale cache only ONCE by default (on-start)", async () => {
    const mockIsCacheStale = vi.fn().mockResolvedValue(false);
    
    const sanityClient = createSanityClient();
    const onStartLoader = createSanityLoader({
      client: sanityClient,
      paths: paths,
      isCacheStale: mockIsCacheStale,
      // invalidateCachePerCall is false by default
    });
    
    const fetchPosts = onStartLoader.defineLoader({ queryName: "posts" });
    const fetchPostsAgain = onStartLoader.defineLoader({ queryName: "posts" });

    await fetchPosts();
    await fetchPostsAgain();

    expect(mockIsCacheStale).toHaveBeenCalledTimes(1);
  });

  it("should check for stale cache on EACH call when invalidateCachePerCall is true", async () => {
    const mockIsCacheStale = vi.fn().mockResolvedValue(false);
    
    const sanityClient = createSanityClient();
    const perCallLoader = createSanityLoader({
      client: sanityClient,
      paths: paths,
      isCacheStale: mockIsCacheStale,
      invalidateCachePerCall: true, // Explicitly enable per-call checking
    });
    
    const fetchPosts = perCallLoader.defineLoader({ queryName: "posts" });
    const fetchPostsAgain = perCallLoader.defineLoader({ queryName: "posts" });

    await fetchPosts();
    await fetchPostsAgain();

    expect(mockIsCacheStale).toHaveBeenCalledTimes(2);
  });

});
