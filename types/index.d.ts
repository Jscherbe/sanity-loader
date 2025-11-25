/**
 * @typedef {import('@sanity/client').SanityClient} SanityClient
 * @typedef {import('@sanity/image-url/lib/types/builder').ImageUrlBuilder} ImageUrlBuilder
 */
/**
 * @typedef {object} SanityLoader
 * @property {SanityClient} client - The configured Sanity client instance.
 * @property {(options: object) => () => Promise<any>} defineLoader - Defines a data loader for a specific query.
 * @property {(source: object) => ImageUrlBuilder} imageUrl - The Sanity image URL builder instance.
 * @property {{ fixPortableText: (...fields: Array<object>[]) => void, saveAsset: (url: string) => Promise<string | null> }} utils - Utility functions.
 */
/**
 * Creates the main Sanity Loader instance.
 * @param {object} config - The configuration object.
 * @returns {SanityLoader} The Sanity Loader instance.
 */
export function createSanityLoader(config: object): SanityLoader;
export type SanityClient = import("@sanity/client").SanityClient;
export type ImageUrlBuilder = import("@sanity/image-url/lib/types/builder").ImageUrlBuilder;
export type SanityLoader = {
    /**
     * - The configured Sanity client instance.
     */
    client: SanityClient;
    /**
     * - Defines a data loader for a specific query.
     */
    defineLoader: (options: object) => () => Promise<any>;
    /**
     * - The Sanity image URL builder instance.
     */
    imageUrl: (source: object) => ImageUrlBuilder;
    /**
     * - Utility functions.
     */
    utils: {
        fixPortableText: (...fields: Array<object>[]) => void;
        saveAsset: (url: string) => Promise<string | null>;
    };
};
//# sourceMappingURL=index.d.ts.map