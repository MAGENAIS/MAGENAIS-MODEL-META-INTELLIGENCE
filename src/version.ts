/**
 * Version metadata for the standalone package. The single in-code source of
 * these constants; `tests/versioning.test.ts` asserts they agree with
 * package.json, model.json and the benchmark's own version string.
 */

/** Package / manifest version of this standalone release (Meta-Intelligence V2). */
export const META_INTELLIGENCE_VERSION = '2.0.0';

/** Stable model id, matching `model.json`'s `id`. */
export const META_INTELLIGENCE_MODEL_ID = 'magenais.meta-intelligence';

/** Canonical URI form, matching `model.json`'s `uri`. */
export const META_INTELLIGENCE_URI = `magenais://meta-intelligence@${META_INTELLIGENCE_VERSION}`;
