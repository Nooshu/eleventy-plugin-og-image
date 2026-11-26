import { promises as fs } from 'node:fs';
import path from 'node:path';
import { mergeOptions } from './src/utils/index.js';
import { BuildCache } from './src/buildCache.js';
import { OgImageManifest } from './src/manifest.js';
import { ConcurrencyLimiter } from './src/concurrencyLimiter.js';
import { createOgImageShortcode } from './src/ogImageShortcode.js';

/**
 * @param {import('@11ty/eleventy/src/UserConfig').default} eleventyConfig
 * @param {EleventyPluginOgImageOptions} pluginOptions
 */
export default async function (eleventyConfig, pluginOptions) {
  /** @type {DirectoriesConfig} */
  let directoriesConfig;

  /** @type {EleventyPluginOgImageMergedOptions} */
  let mergedOptions;

  // Until https://github.com/11ty/eleventy/issues/2729 is fixed
  eleventyConfig.on('eleventy.directories', (dir) => {
    directoriesConfig = dir;
    mergedOptions = mergeOptions({ directoriesConfig, pluginOptions });
  });

  /** @type {import('@11ty/eleventy/src/TemplateConfig').default} */
  let templateConfig;

  /** @type {import('@11ty/eleventy/src/EleventyExtensionMap').default} */
  let extensionMap;

  eleventyConfig.on('eleventy.config', (newTemplateConfig) => {
    templateConfig = newTemplateConfig;
  });

  eleventyConfig.on('eleventy.extensionmap', (map) => {
    extensionMap = map;
  });

  /** @type {boolean} */
  let previewEnabled;

  const buildCache = new BuildCache();
  /** @type {OgImageManifest | undefined} */
  let manifest;
  /** @type {ConcurrencyLimiter} */
  let renderLimiter = new ConcurrencyLimiter(pluginOptions?.maxConcurrency);

  eleventyConfig.on('eleventy.before', async ({ runMode }) => {
    buildCache.clear();
    renderLimiter = new ConcurrencyLimiter(mergedOptions.maxConcurrency);

    try {
      await fs.mkdir(mergedOptions.outputDir, { recursive: true });
    } catch {
      // outputDir may already exist or be unwritable in edge cases; shortcode fails later if needed.
    }

    if (mergedOptions.manifest) {
      manifest = new OgImageManifest(path.join(mergedOptions.outputDir, '.og-image-manifest.json'));
      await manifest.load();
    } else {
      manifest = undefined;
    }

    previewEnabled =
      mergedOptions.previewMode === 'auto' ? ['watch', 'serve'].includes(runMode) : mergedOptions.previewMode;

    if (previewEnabled) {
      try {
        await fs.mkdir(mergedOptions.previewDir, { recursive: true });
      } catch {
        // Preview mkdir failures are non-fatal; shortcode may still create nested dirs.
      }
    } else {
      try {
        await fs.rm(mergedOptions.previewDir, { recursive: true, force: true });
      } catch {
        // Preview dir may already be absent.
      }
    }
  });

  eleventyConfig.on('eleventy.after', async () => {
    if (manifest) {
      await manifest.save();
    }
  });

  eleventyConfig.ignores.add(mergeOptions({ pluginOptions }).inputFileGlob);

  eleventyConfig.addAsyncShortcode(
    'ogImage',
    createOgImageShortcode({
      eleventyConfig,
      getDirectoriesConfig: () => directoriesConfig,
      getMergedOptions: () => mergedOptions,
      getTemplateConfig: () => templateConfig,
      getExtensionMap: () => extensionMap,
      buildCache,
      getManifest: () => manifest,
      isPreviewEnabled: () => previewEnabled,
      getRenderLimiter: () => renderLimiter,
      pluginOptions,
    }),
  );
}
