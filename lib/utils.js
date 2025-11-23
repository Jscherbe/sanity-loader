import { filterInPlace } from "@ulu/utils/array.js";

/**
 * Sanitizes Sanity portable text arrays by removing invalid blocks.
 * This function mutates the arrays in place.
 * @param {...Array<object>} fields - One or more portable text arrays to sanitize.
 */
export function fixPortableText(...fields) {
  fields.forEach(field => {
    if (Array.isArray(field)) {
      return filterInPlace(field, block => block._type);
    }
  });
}