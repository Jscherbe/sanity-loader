import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@sanity/client';
import { createSanityLoader } from '../lib/index.js';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sanityConfig = {
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_API_TOKEN,
  useCdn: false, // Use false for testing to ensure fresh data
  apiVersion: '2023-05-03' // Use a specific API version
};

// Basic validation to ensure credentials are in the .env file
if (!sanityConfig.projectId || !sanityConfig.dataset || !sanityConfig.token) {
  throw new Error(
    'Sanity projectId, dataset, and token must be defined in your .env file. Please replace the placeholder values.'
  );
}

// Create the Sanity client instance outside of the loader
const sanityClient = createClient(sanityConfig);

describe('Sanity Loader: Basic Fetching', () => {

  it('should fetch all posts from the Sanity database', async () => {
    // Create a loader instance, passing the client instance directly
    const sanityLoader = createSanityLoader({
      client: sanityClient,
      paths: {
        // Provide dummy paths for correct initialization, even if not all are used in this test
        cache: './.cache',
        queries: './queries',
        assetsFs: './assets',
        assetsPublic: '/assets'
      }
    });

    // Define a loader to fetch all documents of type "post"
    // Caching must be disabled when providing a raw query without a `queryName`.
    const fetchPosts = sanityLoader.defineLoader({
      query: `*[_type == "post"]`,
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
      'Advanced Content Modeling',
      'Getting Started with Sanity.io',
      'The Art of Landscape Photography'
    ]);
  });

});
