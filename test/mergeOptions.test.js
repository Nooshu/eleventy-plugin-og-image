import test from 'ava';
import { mergeOptions } from '../src/utils/index.js';
import { directoriesConfig } from './utils/directoriesConfig.js';

test('works without pluginOptions', (t) => {
  const { satoriOptions, sharpOptions, ...options } = mergeOptions({ directoriesConfig });

  t.truthy(options);
  t.truthy(satoriOptions);
  t.falsy(sharpOptions);
});

test('works without directoriesConfig', (t) => {
  const options = mergeOptions({});

  t.is(options.outputDir, 'og-images');
  t.is(options.previewDir, 'og-images/preview');
  t.is(options.urlPath, 'og-images');
});

test('creates default options', (t) => {
  const { satoriOptions, sharpOptions, ...options } = mergeOptions({ directoriesConfig });

  t.is(options.outputFileExtension, 'png');
  t.is(options.inputFileGlob, '**/*.og.*');
  t.is(options.hashLength, 8);
  t.is(options.previewMode, 'auto');
  t.is(options.slugStrategy, 'contentHash');
  t.true(options.manifest);
  t.is(options.maxConcurrency, undefined);

  t.is(satoriOptions.width, 1200);
  t.is(satoriOptions.height, 630);
  t.deepEqual(satoriOptions.fonts, []);

  t.falsy(sharpOptions);
  t.truthy(options.optionsHash);
  t.truthy(options.preparedOptionsForHash);
});

test('changes previewDir and urlPath if only outputDir is set', (t) => {
  const CUSTOM_OUTPUT_DIR = 'custom-output';

  const { outputDir, previewDir, urlPath } = mergeOptions({
    directoriesConfig,
    pluginOptions: { outputDir: CUSTOM_OUTPUT_DIR },
  });

  t.is(outputDir, `_site/${CUSTOM_OUTPUT_DIR}`);
  t.is(previewDir, `_site/${CUSTOM_OUTPUT_DIR}/preview`);
  t.is(urlPath, CUSTOM_OUTPUT_DIR);
});

test('respects explicit previewDir, urlPath, and maxConcurrency', (t) => {
  const options = mergeOptions({
    directoriesConfig,
    pluginOptions: {
      outputDir: 'og',
      previewDir: 'previews',
      urlPath: '/cdn/og',
      maxConcurrency: 3,
      manifest: false,
      slugStrategy: 'pageUrl',
      hashLength: 12,
      outputFileExtension: 'jpeg',
      satoriOptions: { width: 800 },
      sharpOptions: { quality: 90 },
    },
  });

  t.is(options.previewDir, '_site/previews');
  t.is(options.urlPath, '/cdn/og');
  t.is(options.maxConcurrency, 3);
  t.false(options.manifest);
  t.is(options.slugStrategy, 'pageUrl');
  t.is(options.hashLength, 12);
  t.is(options.outputFileExtension, 'jpeg');
  t.is(options.satoriOptions.width, 800);
  t.is(options.satoriOptions.height, 630);
  t.deepEqual(options.sharpOptions, { quality: 90 });
});

test('default outputFileSlug uses content hash strategy', async (t) => {
  const options = mergeOptions({ directoriesConfig });
  const hash = await options.outputFileSlug({
    options,
    data: { page: { url: '/x/' } },
    hash: async () => 'abcdef12',
  });

  t.is(hash, 'abcdef12');
});

test('default outputFileSlug uses pageUrl strategy when configured', async (t) => {
  const options = mergeOptions({
    directoriesConfig,
    pluginOptions: { slugStrategy: 'pageUrl' },
  });

  const slug = await options.outputFileSlug({
    options,
    data: { page: { url: '/blog/hello/' } },
  });

  t.is(slug, 'blog-hello');
});

test('custom shortcodeOutput and outputFileSlug are preserved', async (t) => {
  const options = mergeOptions({
    directoriesConfig,
    pluginOptions: {
      outputFileSlug: async () => 'custom-slug',
      shortcodeOutput: async () => 'CUSTOM',
    },
  });

  t.is(await options.outputFileSlug({}), 'custom-slug');
  t.is(await options.shortcodeOutput({}), 'CUSTOM');
});
