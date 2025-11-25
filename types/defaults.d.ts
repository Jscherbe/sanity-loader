export namespace loaderDefaults {
    let queryName: any;
    let query: any;
    let transform: any;
    let cacheEnabled: boolean;
    let expectedVersion: any;
}
export namespace defaultSanityLoaderOptions {
    export let verbose: boolean;
    export let client: any;
    export let clientConfig: any;
    export let paths: {};
    export { isCacheStale };
    export let invalidateCachePerCall: boolean;
}
export type SanityClient = import("@sanity/client").SanityClient;
/**
 * The default cache invalidation strategy.
 * It compares the timestamp of the most recently updated document in Sanity
 * with a locally cached timestamp.
 * @param {SanityClient} client - The Sanity client instance.
 * @param {{cacheDir: string}} context - The context object.
 * @returns {Promise<boolean>} A promise that resolves to true if the cache is stale.
 */
declare function isCacheStale(client: SanityClient, { cacheDir }: {
    cacheDir: string;
}): Promise<boolean>;
export {};
//# sourceMappingURL=defaults.d.ts.map