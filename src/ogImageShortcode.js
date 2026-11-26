import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TemplatePath } from '@11ty/eleventy-utils';
import { OgImage } from './OgImage.js';
import { buildCacheKey } from './buildCache.js';

/**
 * Creates the `ogImage` async shortcode handler.
 *
 * @param {object} context
 * @param {import('@11ty/eleventy/src/UserConfig').default} context.eleventyConfig
 * @param {() => DirectoriesConfig} context.getDirectoriesConfig
 * @param {() => EleventyPluginOgImageMergedOptions} context.getMergedOptions
 * @param {() => import('@11ty/eleventy/src/TemplateConfig').default} context.getTemplateConfig
 * @param {() => import('@11ty/eleventy/src/EleventyExtensionMap').default} context.getExtensionMap
 * @param {import('./buildCache.js').BuildCache} context.buildCache
 * @param {() => import('./manifest.js').OgImageManifest | undefined} context.getManifest
 * @param {() => boolean} context.isPreviewEnabled
 * @param {() => import('./concurrencyLimiter.js').ConcurrencyLimiter} context.getRenderLimiter
 * @param {EleventyPluginOgImageOptions} [context.pluginOptions]
 * @returns {(shortcodeInputPath: string, data?: Record<string, any>) => Promise<string | null>}
 */
export function createOgImageShortcode({
  eleventyConfig,
  getDirectoriesConfig,
  getMergedOptions,
  getTemplateConfig,
  getExtensionMap,
  buildCache,
  getManifest,
  isPreviewEnabled,
  getRenderLimiter,
  pluginOptions,
}) {
  return async function ogImageShortcode(shortcodeInputPath, data) {
    if (this.page.url === false) {
      return null;
    }

    const directoriesConfig = getDirectoriesConfig();
    const mergedOptions = getMergedOptions();
    const { satoriOptions, ...options } = mergedOptions;

    const joinedInputPath = TemplatePath.standardizeFilePath(path.join(directoriesConfig.input, shortcodeInputPath));

    try {
      await fs.access(joinedInputPath);
    } catch {
      throw new Error(`Could not find file for the \`ogImage\` shortcode, looking for: ${joinedInputPath}`);
    }

    const templateStat = await fs.stat(joinedInputPath);
    const templateMtime = templateStat.mtimeMs;
    const ogImageData = {
      page: this.page,
      eleventy: this.eleventy,
      eleventyPluginOgImage: {
        inputPath: joinedInputPath,
        width: satoriOptions.width,
        height: satoriOptions.height,
        outputFileExtension: options.outputFileExtension,
      },
      ...data,
    };

    const dataHash = buildCacheKey(joinedInputPath, ogImageData, mergedOptions.optionsHash, templateMtime);

    const ogImage = new (pluginOptions?.OgImage || OgImage)({
      inputPath: joinedInputPath,
      data: ogImageData,
      options: mergedOptions,
      templateConfig: getTemplateConfig(),
      extensionMap: getExtensionMap(),
      buildCache,
      templateMtime,
      cacheKey: dataHash,
    });

    let outputFilePath;
    const manifest = getManifest();

    if (manifest) {
      const manifestEntry = manifest.get(this.page.url);

      if (manifestEntry?.dataHash === dataHash) {
        outputFilePath = TemplatePath.standardizeFilePath(
          path.join(mergedOptions.outputDir, manifestEntry.outputFileName),
        );
        ogImage.resolvedOutputFileName = manifestEntry.outputFileName;
      }
    }

    if (!outputFilePath) {
      outputFilePath = await ogImage.outputFilePath();
    }

    const cacheFilePath = await ogImage.cacheFilePath();

    // Custom OgImage subclasses may use a separate cache path; default class returns outputFilePath.
    if (cacheFilePath !== outputFilePath) {
      try {
        await fs.copyFile(cacheFilePath, outputFilePath);
      } catch {
        // Cache miss is fine; render path below regenerates.
      }
    }

    let didRender = false;

    try {
      await fs.access(outputFilePath);
    } catch {
      didRender = true;
      await getRenderLimiter().run(async () => {
        if (ogImage.canPassthroughPng?.()) {
          await ogImage.writeToFile(outputFilePath);
        } else {
          await (await ogImage.render()).toFile(outputFilePath);
        }
      });

      eleventyConfig.logger.log(`Writing ${TemplatePath.stripLeadingDotSlash(outputFilePath)} from ${joinedInputPath}`);
    }

    if (!ogImage.resolvedOutputFileName) {
      ogImage.resolvedOutputFileName = path.basename(outputFilePath);
    }

    if (manifest) {
      manifest.set(this.page.url, {
        dataHash,
        outputFileName: ogImage.resolvedOutputFileName,
      });
    }

    if (isPreviewEnabled()) {
      const previewFilePath = ogImage.previewFilePath();

      await fs.mkdir(path.dirname(previewFilePath), { recursive: true });
      await fs.copyFile(outputFilePath, previewFilePath);

      const previewHtml =
        didRender || typeof ogImage.previewHtmlImageOnly !== 'function'
          ? await ogImage.previewHtml()
          : await ogImage.previewHtmlImageOnly();
      await fs.writeFile(`${previewFilePath}.html`, previewHtml);
    }

    return ogImage.shortcodeOutput();
  };
}
