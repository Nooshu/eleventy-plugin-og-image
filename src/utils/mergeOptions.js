import path from 'node:path';
import { computeOptionsHash, prepareOptionsForHash } from './computeOptionsHash.js';
import { pageUrlSlug } from './pageUrlSlug.js';
import {
  DEFAULT_HASH_LENGTH,
  DEFAULT_INPUT_FILE_GLOB,
  DEFAULT_MANIFEST,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_OUTPUT_FILE_EXTENSION,
  DEFAULT_PREVIEW_MODE,
  DEFAULT_SATORI_HEIGHT,
  DEFAULT_SATORI_WIDTH,
  DEFAULT_SLUG_STRATEGY,
} from './defaults.js';

/**
 * Merges the plugin options with defaults
 *
 * @param {DirectoriesConfig} [directoriesConfig]
 * @param {EleventyPluginOgImageOptions} [pluginOptions]
 * @returns {EleventyPluginOgImageMergedOptions}
 */
export function mergeOptions({ directoriesConfig, pluginOptions }) {
  const {
    outputDir,
    previewDir,
    urlPath,
    OgImage,
    satoriOptions,
    sharpOptions,
    slugStrategy = DEFAULT_SLUG_STRATEGY,
    outputFileSlug,
    manifest = DEFAULT_MANIFEST,
    maxConcurrency,
    ...options
  } = pluginOptions || {};

  const eleventyOutput = directoriesConfig ? directoriesConfig.output : '';
  const joinedOutputDir = path.join(eleventyOutput, outputDir || DEFAULT_OUTPUT_DIR);

  const mergedSatoriOptions = {
    width: DEFAULT_SATORI_WIDTH,
    height: DEFAULT_SATORI_HEIGHT,
    fonts: [],
    ...satoriOptions,
  };

  const preparedOptionsForHash = prepareOptionsForHash(mergedSatoriOptions, sharpOptions);

  return {
    inputFileGlob: DEFAULT_INPUT_FILE_GLOB,
    hashLength: DEFAULT_HASH_LENGTH,
    outputFileExtension: DEFAULT_OUTPUT_FILE_EXTENSION,
    outputDir: joinedOutputDir,
    previewMode: DEFAULT_PREVIEW_MODE,
    previewDir: path.join(...(previewDir ? [eleventyOutput, previewDir] : [joinedOutputDir, 'preview'])),
    urlPath: urlPath || outputDir || DEFAULT_OUTPUT_DIR,
    slugStrategy,
    manifest,
    maxConcurrency,
    preparedOptionsForHash,
    optionsHash: computeOptionsHash(mergedSatoriOptions, sharpOptions, preparedOptionsForHash),

    /** @param {OgImage} ogImage */
    outputFileSlug:
      outputFileSlug ||
      (async (ogImage) => {
        if (ogImage.options.slugStrategy === 'pageUrl') {
          return pageUrlSlug(ogImage.data);
        }

        return ogImage.hash();
      }),

    /** @param {OgImage} ogImage */
    shortcodeOutput: async (ogImage) => `<meta property="og:image" content="${await ogImage.outputUrl()}" />`,

    ...options,

    satoriOptions: mergedSatoriOptions,
    sharpOptions,
  };
}
