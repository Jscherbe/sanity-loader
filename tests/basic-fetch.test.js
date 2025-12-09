import { describe, it, expect } from "vitest";
import { createSanityClient } from "./utils.js";
import { createSanityLoader } from "../lib/index.js";

// Create the Sanity client instance outside of the loader
const sanityClient = createSanityClient();

describe("Sanity Loader: Basic Fetching", () => {

  it("should fetch all posts from the Sanity database", async () => {
    // Create a loader instance, passing the client instance directly
    const sanityLoader = createSanityLoader({
      client: sanityClient,
      paths: {
        // Provide dummy paths for correct initialization, even if not all are used in this test
        cache: "./tests/.cache",
        queries: "./tests/queries",
        assets: "./tests/assets",
        assetsPublic: "/assets",
      }
    });

    // Define a loader to fetch all documents of type "post"
    // Caching must be disabled when providing a raw query without a `queryName`.
    const fetchPosts = sanityLoader.defineLoader({
      query: "*[_type == 'post']",
      cacheEnabled: false
    });

    // Execute the loader
    const posts = await fetchPosts();

    // Assertions
    expect(posts).toBeDefined();
    expect(Array.isArray(posts)).toBe(true);

    // Check that we got some results, without being specific about the number,
    // as this can change during manual testing.
    expect(posts.length).toBeGreaterThan(0);

    // Check that the returned items have the expected shape of a post document.
    // This is more robust than checking for specific titles.
    const post = posts[0];
    expect(post).toHaveProperty("_id");
    expect(post).toHaveProperty("_type", "post");
    expect(post).toHaveProperty("title");
  });

});
