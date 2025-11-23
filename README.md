# `@ulu/sanity-loader`

[![npm version](https://img.shields.io/npm/v/@ulu/sanity-loader.svg)](https://www.npmjs.com/package/@ulu/sanity-loader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A generic, framework-agnostic loader for Sanity.io content. It handles data fetching, smart caching, and local asset management for any Node.js-based project.

This library provides a robust way to pull content from your Sanity database, cache it intelligently to avoid redundant API calls, and even download remote assets (like images) to serve them locally.

## Features

*   **Build-time Data Fetching:** Fetch Sanity data in any Node.js environment.
*   **Smart Caching:** Automatically invalidate cache when content is updated in Sanity. Also supports manual cache-busting.
*   **Asset Handling:** Utilities to download remote assets (like images) and serve them locally.
*   **Flexible Configuration:** Works with file-based `.groq` queries or inline queries.
*   **Data Transformation:** Process and reshape your data with async functions after it's fetched.

## Core Concepts

This library provides a `createSanityLoader` factory to configure a connection to your Sanity project. Once configured, you can use `defineLoader` to create specific, reusable data loaders for different parts of your Sanity content.

The workflow is as follows:
1.  You configure the main loader with your Sanity credentials and local path settings.
2.  You define a "loader" for a piece of Sanity data (e.g., site settings, page content).
3.  The loader specifies a GROQ query and optional caching strategy.
4.  When the loader is executed, it fetches data from Sanity or retrieves it from a local cache.
5.  The data can be transformed before being returned.

## Installation

```bash
npm install @ulu/sanity-loader @sanity/client
```

## Quick Start

Here’s how you might use the loader in a generic build script.

### 1. Project Setup

Let's assume you have a project structure like this:

```
.
├── build-script.js
├── queries/
│   └── siteSettings.groq
└── .cache/
    └── sanity/
```

Your `queries/siteSettings.groq` file might contain:
```groq
*[_type == "siteSettings"][0]
```

### 2. Configuration & Usage

Now, set up and use the loader in your `build-script.js`:

```javascript
import { createSanityLoader } from '@ulu/sanity-loader';
import { createClient } from '@sanity/client';
import path from 'path';

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
    queries: path.resolve(process.cwd(), 'queries'),
    cache: path.resolve(process.cwd(), '.cache/sanity'),
    assetsFs: path.resolve(process.cwd(), 'public/assets/sanity'),
    assetsPublic: '/assets/sanity'
  },
  verbose: true // Enable logging for debugging
});

// 3. Define a loader for your site settings
const getSiteSettings = sanityLoader.defineLoader({
  queryName: 'siteSettings', // Reads from queries/siteSettings.groq
  cacheEnabled: true
});

// 4. Run the loader to get your data
(async () => {
  const siteSettings = await getSiteSettings();
  console.log(siteSettings.siteTitle);
})();
```

## Configuration (`createSanityLoader`)

The `createSanityLoader` function accepts a single configuration object:

| Key           | Type     | Description                                                                                                                            |
|---------------|----------|----------------------------------------------------------------------------------------------------------------------------------------|
| `client`      | `object` | **(Recommended)** An existing, pre-configured Sanity client instance from `@sanity/client`.                                            |
| `sanity`      | `object` | **(Alternative)** A configuration object to create a new Sanity client if `client` is not provided.                                    |
| `paths`       | `object` | An object defining various paths for the library to use.                                                                               |
| `paths.queries` | `string` | Absolute path to the directory containing your `.groq` query files.                                                                    |
| `paths.cache`   | `string` | Absolute path to the directory where cached Sanity data will be stored.                                                                |
| `paths.assetsFs`| `string` | Absolute path on the filesystem where downloaded assets should be saved.                                                               |
| `paths.assetsPublic`| `string` | The public URL path from which the saved assets will be served.                                                                        |
| `autoCacheInvalidation` | `boolean` | If `true`, checks Sanity for new content once per run and invalidates cache if changes are found. Defaults to `true`. |
| `verbose`     | `boolean`| Set to `true` to enable detailed logging. Defaults to `false`.                                                                         |

## Creating Loaders (`defineLoader`)

The `defineLoader` function creates a reusable, executable loader for a specific piece of data. It accepts an options object:

| Key               | Type       | Description                                                                                             |
|-------------------|------------|---------------------------------------------------------------------------------------------------------|
| `queryName`       | `string`   | The name of the `.groq` file (without extension) in your `paths.queries` directory.                     |
| `query`           | `string`   | An inline GROQ query string. Use this if you don't want to use a separate file.                         |
| `transform`       | `function` | An async function to process or reshape the data after it's fetched. Receives the raw result as an argument. |
| `cacheEnabled`    | `boolean`  | Set to `true` to enable caching for this loader. Requires `queryName`. Defaults to `true`.             |
| `expectedVersion` | `string`   | A string (like a version number or hash) to manually bust the cache if the data structure changes.      |


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
*   `loader.utils.saveAsset(url)`: A utility to download an asset from a URL, save it to your `paths.assetsFs` directory, and return its public path. It avoids re-downloading if the file already exists.

## License

MIT

