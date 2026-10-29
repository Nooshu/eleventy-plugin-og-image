import test from 'ava';
import { RenderPlugin } from '@11ty/eleventy';
import { OgImage } from '../src/OgImage.js';
import { BuildCache, buildCacheKey } from '../src/buildCache.js';
import { testConstructor } from './utils/testConstructor.js';

test('build cache deduplicates html rendering across OgImage instances', async (t) => {
  const buildCache = new BuildCache();
  let renderCount = 0;

  const originalFile = RenderPlugin.File;
  RenderPlugin.File = async () => {
    renderCount += 1;

    return async () => '<div class="root"></div>\n';
  };

  t.teardown(() => {
    RenderPlugin.File = originalFile;
  });

  const sharedData = { page: { url: '/shared/' }, title: 'Shared' };

  const first = new OgImage({ ...testConstructor, data: sharedData, buildCache });
  const second = new OgImage({ ...testConstructor, data: sharedData, buildCache });

  const firstHtml = await first.html();
  const secondHtml = await second.html();

  t.is(renderCount, 1);
  t.is(firstHtml, secondHtml);
});

test('buildCacheKey includes template mtime when provided', (t) => {
  const data = { page: { url: '/shared/' } };

  t.not(
    buildCacheKey('./input.og.njk', data, 'options-hash'),
    buildCacheKey('./input.og.njk', data, 'options-hash', 123),
  );
});

test('buildCacheKey ignores functions and serializes buffers', (t) => {
  const key = buildCacheKey(
    './input.og.njk',
    {
      page: { url: '/' },
      ignored: () => {},
      bin: Buffer.from('x'),
      nested: [{ fn: () => {} }, () => {}],
    },
    'options-hash',
  );

  t.regex(key, /^[a-f0-9]{64}$/);
});

test('buildCacheKey serializes null, undefined, nested objects, and empty data', (t) => {
  const withNulls = buildCacheKey(
    './input.og.njk',
    {
      page: { url: '/' },
      empty: null,
      missing: undefined,
      nested: { keep: true, drop: () => {} },
      list: [null, Buffer.from('a'), { inner: undefined }],
    },
    'options-hash',
  );

  const emptyData = buildCacheKey('./input.og.njk', undefined, 'options-hash');

  t.regex(withNulls, /^[a-f0-9]{64}$/);
  t.regex(emptyData, /^[a-f0-9]{64}$/);
  t.not(withNulls, emptyData);
});

test('build cache is cleared between builds', (t) => {
  const buildCache = new BuildCache();

  buildCache.set('key', { html: '<div></div>' });
  buildCache.clear();

  t.is(buildCache.get('key'), undefined);
});

test('build cache merges partial entries for the same key', (t) => {
  const buildCache = new BuildCache();

  buildCache.set('key', { html: '<div></div>' });
  buildCache.set('key', { svg: '<svg></svg>' });

  t.deepEqual(buildCache.get('key'), { html: '<div></div>', svg: '<svg></svg>' });
});

test('build cache hydrate skips missing html/svg/png fields', async (t) => {
  const buildCache = new BuildCache();
  buildCache.set(
    buildCacheKey(testConstructor.inputPath, { page: { url: '/hydrate/' } }, testConstructor.options.optionsHash),
    { svg: '<svg id="cached"></svg>' },
  );

  const ogImage = new OgImage({
    ...testConstructor,
    data: { page: { url: '/hydrate/' } },
    buildCache,
  });

  t.is(await ogImage.svg(), '<svg id="cached"></svg>');
});
