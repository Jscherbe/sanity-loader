# `@ulu/sanity-loader`

[![npm version](https://img.shields.io/npm/v/@ulu/sanity-loader.svg)](https://www.npmjs.com/package/@ulu/sanity-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A generic, framework-agnostic loader for Sanity.io content. It handles data fetching, smart caching, and local asset management for any Node.js-based project.

This library provides a robust way to pull content from your Sanity database, cache it intelligently to avoid redundant API calls, and even download remote assets (like images) to serve them locally.

## Features

*   **Build-time Data Fetching:** Fetch Sanity data in any Node.js environment.
*   **Smart Caching:** Automatically invalidates the cache when content is updated in Sanity.
*   **Customizable Invalidation:** Override the default caching strategy with your own custom logic.
*   **Asset Handling:** Utilities to download remote assets (like images) and serve them locally.
*   **Flexible Configuration:** Works with file-based `.groq` queries or inline queries.
*   **Data Transformation:** Process and reshape your data with async functions after it's fetched.

## Core Concepts

This library provides a `createSanityLoader` factory to configure a connection to your Sanity project. Once configured, you can use `defineLoader` to create specific, reusable data loaders for different parts of your Sanity content.

The workflow is as follows:
1.  You configure the main loader with your Sanity credentials and local path settings.
2.  You define a "loader" for a piece of Sanity data (e.g., site settings, page content).
3.  The loader specifies a GROQ query and caching strategy.
4.  When the loader is executed, it fetches data from Sanity or retrieves it from a local cache.
5.  The data can be transformed before being returned.

## Installation

```bash
npm install @ulu/sanity-loader @sanity/client
```

## Quick Start

Here’s how you might use the loader in a generic build script.

### 1. Project Setup

Let's assume a conventional project structure where all Sanity-related files live inside `src/sanity`:

```
.
├── src/
│   └── sanity/
│       ├── index.js  | loader and project logic
│       ├── queries/  | Groq query files
│       │   ├── posts.groq
│       │   ├── authors.groq
│       │   └── siteSettings.groq
│       └── cache/    | optional, cache directory
└── public/
    └── assets/
        └── sanity/   | optional, for downloaded assets
```

Your `src/sanity/queries/siteSettings.groq` file might contain:
```groq
*[_type == "siteSettings"][0]
```

### 2. Configuration & Usage

Now, set up and use the loader in `src/sanity/index.js`. You can then import and use this setup in any of your project's build scripts.

```javascript
// src/sanity/index.js
import { createSanityLoader } from '@ulu/sanity-loader';
import { createClient } from '@sanity/client';

// 1. Create a Sanity client
const sanityClient = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset',
  useCdn: false, // `false` ensures fresh data for builds
  apiVersion: '2023-05-03',
});

// 2. Create the Sanity Loader instance
const sanityLoader = createSanityLoader({
  client: sanityClient,
  paths: {
    queries: './src/sanity/queries',
    cache: './src/sanity/cache',
    assets: './public/assets/sanity',
    assetsPublic: '/assets/sanity'
  },
  verbose: true // Enable logging for debugging
});

// 3. Define a loader for your site settings
export const getSiteSettings = sanityLoader.defineLoader({
  queryName: 'siteSettings', // Reads from queries/siteSettings.groq
  cacheEnabled: true
});

// 4. Example of running the loader
async function main() {
  const siteSettings = await getSiteSettings();
  console.log(siteSettings.siteTitle);
}

// main(); // Uncomment to run directly
```

## Configuration (`createSanityLoader`)

The `createSanityLoader` function accepts a single configuration object:

| Key           | Type       | Description                                                                                                                                                                                                                                                          |
|---------------|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `client`      | `object`   | **(Recommended)** An existing, pre-configured Sanity client instance from `@sanity/client`.                                                                                                                                                                          |
| `clientConfig`| `object`   | **(Alternative)** A configuration object to create a new Sanity client if `client` is not provided.                                                                                                                                                                  |
| `paths`       | `object`   | An object defining various paths for the library to use. Paths are relative to your project root.                                                                                                                                                                    |
| `paths.queries` | `string`   | Path to the directory containing your `.groq` query files.                                                                                                                                                                                                           |
| `paths.cache`   | `string`   | Path to the directory where cached Sanity data will be stored.                                                                                                                                                                                                       |
| `paths.assets`| `string`   | Path on the filesystem where downloaded assets should be saved.                                                                                                                                                                                                      |
| `paths.assetsPublic`| `string`   | The public URL path from which the saved assets will be served.                                                                                                                                                                                                      |
| `invalidateCachePerCall` | `boolean` | Determines the cache invalidation strategy. If `false` (default), the cache staleness is checked only once on the first loader call. If `true`, it's checked on every call. See [Advanced Cache Invalidation](#advanced-cache-invalidation). |
| `isCacheStale`| `function` | Optional `async` function to override the default cache invalidation logic. Defaults to a timestamp-based check. Its execution is controlled by `invalidateCachePerCall`. See [Advanced Cache Invalidation](#advanced-cache-invalidation) for details. |
| `verbose`     | `boolean`  | Set to `true` to enable detailed logging. Defaults to `false`.                                                                                                                                                                                                       |

## Creating Loaders (`defineLoader`)

The `defineLoader` function creates a reusable, executable loader for a specific piece of data. It accepts an options object:

| Key               | Type       | Description                                                                                             |
|-------------------|------------|---------------------------------------------------------------------------------------------------------|
| `queryName`       | `string`   | The name of the `.groq` file (without extension) in your `paths.queries` directory.                     |
| `query`           | `string`   | An inline GROQ query string. Use this if you don't want to use a separate file.                         |
| `transform`       | `function` | An async function to process or reshape the data after it's fetched. Receives the raw result as an argument. |
| `cacheEnabled`    | `boolean`  | Set to `true` to enable caching for this loader. Requires `queryName`. Defaults to `true`.             |
| `expectedVersion` | `string`   | A string (like a version number or hash) to manually bust the cache if the data structure changes.      |

## Advanced Cache Invalidation

The loader offers two main strategies for checking if the cache is stale, controlled by the `invalidateCachePerCall` option.

### Invalidation Strategies

*   **`invalidateCachePerCall: false` (Default "on-start" strategy)**  
    With this setting, the loader checks for stale content **only once** when the first loader is executed. The result (whether the cache is stale or not) is then reused for all subsequent loader calls. This is the most efficient strategy for build processes where data is expected to be consistent throughout the entire run.

*   **`invalidateCachePerCall: true` ("per-call" strategy)**  
    This setting makes the loader check for stale content on **every single** loader execution. This guarantees the freshest possible data on every call but can be slower if you have many loaders, as each one may trigger a network request to check for updates.

By default, the check itself involves comparing the `_updatedAt` timestamp of the most recently changed document in your Sanity dataset with a timestamp stored locally in your cache directory (`latest-update.txt`).

### Custom Invalidation Logic

You can override the default checking logic entirely by providing a custom `async` function to the `isCacheStale` option. This gives you full control over *how* the cache is determined to be stale.

The function signature is `async (client, context)`, where:
- `client`: The configured Sanity client instance, which you can use to make custom queries.
- `context`: An object containing `{ cacheDir }`, the absolute path to the cache directory.

The function must return a `Promise` that resolves to a `boolean`: `true` if the cache is stale, `false` otherwise.

**Note:** The execution frequency of your custom `isCacheStale` function is still controlled by `invalidateCachePerCall`.

#### Example: Environment-based Invalidation

A common use case is to always fetch fresh data in development but use the efficient default in production. To achieve this, you would use the "per-call" strategy in development.

```javascript
const sanityLoader = createSanityLoader({
  //...
  // In dev, check every time. In prod, check only once at the start.
  invalidateCachePerCall: process.env.NODE_ENV === 'development',
});
```

#### Example: Custom Query Logic

If you want to base the invalidation on a specific document type, you can provide a custom `isCacheStale` function.

```javascript
import fs from 'fs-extra';
import path from 'path';

const postOnlyInvalidation = async (client, { cacheDir }) => {
  const metadataFile = path.join(cacheDir, 'latest-post-update.txt');
  const cachedTimestamp = fs.existsSync(metadataFile) ? fs.readFileSync(metadataFile).toString() : null;

  const liveTimestamp = await client.fetch(`*[_type == "post"] | order(_updatedAt desc)[0]._updatedAt`);
  const isStale = !liveTimestamp || liveTimestamp !== cachedTimestamp;

  if (isStale && liveTimestamp) {
    fs.ensureDirSync(cacheDir);
    fs.writeFileSync(metadataFile, liveTimestamp);
  }

  return isStale;
};

const sanityLoader = createSanityLoader({
  //...
  isCacheStale: postOnlyInvalidation,
  // This custom function will run based on invalidateCachePerCall (defaults to once)
});
```

### Example with `transform`

Transforms are powerful for cleaning up data or handling assets.

```javascript
const getPage = sanityLoader.defineLoader({
  query: `*[_type == "page" && slug.current == "about-us"][0]`,
  async transform(result) {
    // Example: Download the main image and replace the remote URL with a local one
    if (result.mainImage) {
      const imageUrl = sanityLoader.imageUrl(result.mainImage).width(800).url();
      result.mainImage.localUrl = await sanityLoader.utils.saveAsset(imageUrl);
    }
    return result;
  }
});

const aboutPage = await getPage();
console.log(aboutPage.mainImage.localUrl); // -> /assets/sanity/image-....jpg
```

## API Reference

The `createSanityLoader` function returns an API object that you can use in your scripts.

*   `loader.client`: The underlying Sanity client instance.
*   `loader.defineLoader(options)`: The loader factory function described above.
*   `loader.imageUrl(source)`: An instance of the `@sanity/image-url` builder, ready to use.
*   `loader.utils.fixPortableText(...fields)`: A utility to sanitize portable text arrays by removing invalid blocks in-place.
*   `loader.utils.saveAsset(url)`: A utility to download an asset from a URL, save it to your `paths.assets` directory, and return its public path. It avoids re-downloading if the file already exists.
*   `loader.config`: The fully resolved configuration object used by the loader instance.

## License

MIT

