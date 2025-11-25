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
    
    // We created 3 posts earlier
    expect(posts.length).toBe(3);

    // Check for a known property on one of the posts
    const postTitles = posts.map(p => p.title).sort();
    expect(postTitles).toEqual([
      "Advanced Content Modeling",
      "Getting Started with Sanity.io",
      "The Art of Landscape Photography"
    ]);
  });

});
