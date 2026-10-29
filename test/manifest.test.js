import test from 'ava';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OgImageManifest } from '../src/manifest.js';
import { OgImage } from '../src/OgImage.js';
import { buildCacheKey } from '../src/buildCache.js';
import { mergeOptions } from '../src/utils/index.js';
import { directoriesConfig } from './utils/directoriesConfig.js';

async function createTmpDir(t) {
  const dir = path.join(os.tmpdir(), `eleventy-plugin-og-image-manifest-${process.pid}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  t.teardown(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  return dir;
}

test('manifest save tolerates mkdir failures', async (t) => {
  const dir = await createTmpDir(t);
  const manifestPath = path.join(dir, 'manifest-as-file', '.og-image-manifest.json');
  await fs.writeFile(path.join(dir, 'manifest-as-file'), 'not a dir', 'utf8');

  const manifest = new OgImageManifest(manifestPath);
  manifest.set('/page/', { dataHash: 'abc', outputFileName: 'page.png' });

  await t.throwsAsync(async () => manifest.save());
});

test('manifest persists entries between load and save', async (t) => {
  const dir = await createTmpDir(t);
  const manifestPath = path.join(dir, '.og-image-manifest.json');
  const manifest = new OgImageManifest(manifestPath);

  manifest.set('/page/', { dataHash: 'abc', outputFileName: 'page.png' });
  await manifest.save();

  const reloaded = new OgImageManifest(manifestPath);
  await reloaded.load();

  t.deepEqual(reloaded.get('/page/'), { dataHash: 'abc', outputFileName: 'page.png' });
});

test('manifest load starts empty when file is missing or invalid', async (t) => {
  const dir = await createTmpDir(t);
  const missing = new OgImageManifest(path.join(dir, 'missing.json'));
  await missing.load();
  t.is(missing.get('/any/'), undefined);

  const invalidPath = path.join(dir, 'invalid.json');
  await fs.writeFile(invalidPath, '{not-json', 'utf8');
  const invalid = new OgImageManifest(invalidPath);
  await invalid.load();
  t.is(invalid.get('/any/'), undefined);
});

test('manifest get returns undefined for unknown pages', async (t) => {
  const dir = await createTmpDir(t);
  const manifest = new OgImageManifest(path.join(dir, '.og-image-manifest.json'));
  manifest.set('/known/', { dataHash: 'abc', outputFileName: 'known.png' });

  t.is(manifest.get('/unknown/'), undefined);
  t.deepEqual(manifest.get('/known/'), { dataHash: 'abc', outputFileName: 'known.png' });
});

test('manifest entry allows resolving output filename without hashing html', async (t) => {
  const options = mergeOptions({
    directoriesConfig,
    pluginOptions: {
      slugStrategy: 'pageUrl',
    },
  });

  const data = { page: { url: '/cached-page/' } };
  const dataHash = buildCacheKey('./test/og-test.og.njk', data, options.optionsHash, 1000);

  const ogImage = new OgImage({
    inputPath: './test/og-test.og.njk',
    data,
    options,
    templateConfig: undefined,
    templateMtime: 1000,
  });

  ogImage.resolvedOutputFileName = 'cached-page.png';

  t.is(await ogImage.outputFileName(), 'cached-page.png');
  t.is(dataHash, buildCacheKey('./test/og-test.og.njk', data, options.optionsHash, 1000));
});
