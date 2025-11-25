import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { getUrlDirname } from "@ulu/utils/node/path.js";
import { createClient } from "@sanity/client";

const __dirname = getUrlDirname(import.meta.url);
const envPath = path.resolve(__dirname, "sanity-database/.env.local");

dotenv.config({ path: envPath });

if (!fs.existsSync(envPath)) {
  console.warn(`.env file not found at: ${ envPath }`);
}

/**
 * Returns a new sanity client for tests
 */
export function createSanityClient() {
  const config = {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET,
    token: process.env.SANITY_STUDIO_API_TOKEN,
    useCdn: false,
    apiVersion: "2023-05-03",
  };

  // Basic validation to ensure credentials are in the .env file
  if (!config.projectId || !config.dataset || !config.token) {
    console.error(config);
    throw new Error(
      "Sanity projectId, dataset, and token must be defined in your .env file. Please replace the placeholder values."
    );
  }
  return createClient(config);
}