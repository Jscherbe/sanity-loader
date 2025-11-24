/* global process */
import path from 'path';
import dotenv from 'dotenv';
import { getUrlDirname } from "@ulu/utils/node/path.js";
import { createClient } from '@sanity/client';

const __dirname = getUrlDirname(import.meta.url);

dotenv.config({ 
  path: path.resolve(__dirname, 'sanity-loader/tests/sanity-database/.env.local')
});

/**
 * Returns a new sanity client for tests
 */
export function createSanityClient() {
  const config = {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET,
    token: process.env.SANITY_STUDIO_API_TOKEN,
    useCdn: false,
    apiVersion: '2023-05-03',
  };

  // Basic validation to ensure credentials are in the .env file
  if (!config.projectId || !config.dataset || !config.token) {
    throw new Error(
      'Sanity projectId, dataset, and token must be defined in your .env file. Please replace the placeholder values.'
    );
  }
  return createClient(config);
}