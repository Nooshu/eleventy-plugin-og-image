import test from 'ava';
import { createHash } from 'node:crypto';
import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import Eleventy from '@11ty/eleventy';
import { OgImage } from '../src/OgImage.js';
import { BuildCache, buildCacheKey } from '../src/buildCache.js';
import { testConstructor } from './utils/testConstructor.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/image-regression.json', import.meta.url), 'utf8'));

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fixtureOgImage(overrides = {}) {
  return new OgImage({
    ...testConstructor,
    data: { page: { url: golden.pageUrl } },
    ...overrides,
  });
}

async function mkTmpDir(t) {
  const dir = path.join(os.tmpdir(), `eleventy-plugin-og-image-regression-${process.pid}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  t.teardown(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  return dir;
}

test('unit golden HTML SVG and PNG digests match committed fixtures', async (t) => {
  const ogImage = fixtureOgImage();
  const html = await ogImage.html();
  const svg = await ogImage.svg();
  const pngBuffer = await ogImage.pngBuffer();
  const meta = await sharp(pngBuffer).metadata();

  t.is(sha256(html), golden.htmlSha256);
  t.is(sha256(svg), golden.svgSha256);
  t.is(sha256(pngBuffer), golden.pngSha256);
  t.is(meta.width, golden.width);
  t.is(meta.height, golden.height);
  t.is(meta.format, golden.format);
  t.is(await ogImage.hash(), golden.contentHashSlug);
});

test('passthrough write fidelity matches golden PNG digest', async (t) => {
  const ogImage = fixtureOgImage();
  const pngBuffer = await ogImage.pngBuffer();
  const outputPath = path.join(os.tmpdir(), `og-regression-passthrough-${process.pid}.png`);

  t.teardown(async () => {
    await fs.rm(outputPath, { force: true });
  });

  t.true(ogImage.canPassthroughPng());
  await ogImage.writeToFile(outputPath);

  const written = await fs.readFile(outputPath);
  t.deepEqual(written, pngBuffer);
  t.is(sha256(written), golden.pngSha256);
});

test('JPEG sharp path is byte-stable for fixed quality', async (t) => {
  const ogImage = fixtureOgImage({
    options: {
      ...testConstructor.options,
      outputFileExtension: 'jpeg',
      sharpOptions: { quality: golden.jpegQuality },
    },
  });

  const jpegBuffer = await (await ogImage.render()).toBuffer();
  const meta = await sharp(jpegBuffer).metadata();

  t.is(sha256(jpegBuffer), golden.jpegSha256);
  t.is(meta.width, golden.jpegWidth);
  t.is(meta.height, golden.jpegHeight);
  t.is(meta.format, golden.jpegFormat);
});

test('build cache reuse preserves golden PNG digest', async (t) => {
  const buildCache = new BuildCache();
  const sharedData = { page: { url: golden.pageUrl } };

  const first = fixtureOgImage({ data: sharedData, buildCache });
  const second = fixtureOgImage({ data: sharedData, buildCache });

  const firstDigest = sha256(await first.pngBuffer());
  const secondDigest = sha256(await second.pngBuffer());

  t.is(firstDigest, golden.pngSha256);
  t.is(secondDigest, golden.pngSha256);
  t.is(first.results.pngBuffer, second.results.pngBuffer);
});

test('previewHtmlImageOnly does not re-render html or svg', async (t) => {
  const ogImage = fixtureOgImage();
  ogImage.resolvedOutputFileName = `${golden.contentHashSlug}.png`;

  const preview = await ogImage.previewHtmlImageOnly();

  t.regex(preview, new RegExp(`<title>OG Image: ${golden.pageUrl}</title>`));
  t.regex(preview, new RegExp(`src="/og-images/${golden.contentHashSlug}\\.png"`));
  t.false(preview.includes('eleventy-plugin-og-image-html'));
  t.falsy(ogImage.results.html);
  t.falsy(ogImage.results.svg);
});

test.serial('integration Eleventy build writes golden PNG bytes', async (t) => {
  const root = await mkTmpDir(t);
  const inputDir = path.join(root, 'input');
  const outputDir = path.join(root, '_site');
  const repoRoot = path.resolve('.');
  const fixtureTemplate = await fs.readFile(path.join(repoRoot, 'test/og-test.og.njk'), 'utf8');

  await fs.mkdir(inputDir, { recursive: true });
  await fs.writeFile(path.join(inputDir, 'og-test.og.njk'), fixtureTemplate, 'utf8');
  await fs.writeFile(
    path.join(inputDir, 'page.njk'),
    `<!doctype html><html><head>{% ogImage "./og-test.og.njk" %}</head><body>ok</body></html>`,
    'utf8',
  );

  const configPath = path.join(root, '.eleventy.js');
  await fs.writeFile(
    configPath,
    `import EleventyPluginOgImage from ${JSON.stringify(path.join(repoRoot, '.eleventy.js'))};

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyPluginOgImage, {
    outputFileSlug: async () => ${JSON.stringify(golden.contentHashSlug)},
    outputFileExtension: "png",
    outputDir: "og-images",
    urlPath: "og-images",
    previewMode: false,
    satoriOptions: { width: ${golden.width}, height: ${golden.height}, fonts: [] },
  });
};
`,
    'utf8',
  );

  const elev = new Eleventy(inputDir, outputDir, { configPath, quietMode: true });
  await elev.init();
  await elev.write();

  const imageOutPath = path.join(outputDir, 'og-images', `${golden.contentHashSlug}.png`);
  const written = await fs.readFile(imageOutPath);

  t.is(sha256(written), golden.pngSha256);
});

test.serial('integration manifest cache hit leaves on-disk PNG digest unchanged', async (t) => {
  const root = await mkTmpDir(t);
  const inputDir = path.join(root, 'input');
  const outputDir = path.join(root, '_site');
  const repoRoot = path.resolve('.');
  const fixtureTemplate = await fs.readFile(path.join(repoRoot, 'test/og-test.og.njk'), 'utf8');

  await fs.mkdir(inputDir, { recursive: true });
  await fs.writeFile(path.join(inputDir, 'og-test.og.njk'), fixtureTemplate, 'utf8');
  await fs.writeFile(
    path.join(inputDir, 'page.njk'),
    `<!doctype html><html><head>{% ogImage "./og-test.og.njk" %}</head><body>ok</body></html>`,
    'utf8',
  );

  const configPath = path.join(root, '.eleventy.js');
  await fs.writeFile(
    configPath,
    `import EleventyPluginOgImage from ${JSON.stringify(path.join(repoRoot, '.eleventy.js'))};

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyPluginOgImage, {
    slugStrategy: "pageUrl",
    outputFileExtension: "png",
    outputDir: "og-images",
    urlPath: "og-images",
    previewMode: false,
    manifest: true,
    satoriOptions: { width: ${golden.width}, height: ${golden.height}, fonts: [] },
  });
};
`,
    'utf8',
  );

  const elev1 = new Eleventy(inputDir, outputDir, { configPath, quietMode: true });
  await elev1.init();
  await elev1.write();

  const imageOutPath = path.join(outputDir, 'og-images', 'page.png');
  const firstDigest = sha256(await fs.readFile(imageOutPath));
  t.is(firstDigest, golden.pngSha256);

  const mtimeBefore = (await fs.stat(imageOutPath)).mtimeMs;

  const elev2 = new Eleventy(inputDir, outputDir, { configPath, quietMode: true });
  await elev2.init();
  await elev2.write();

  const secondDigest = sha256(await fs.readFile(imageOutPath));
  const mtimeAfter = (await fs.stat(imageOutPath)).mtimeMs;

  t.is(secondDigest, firstDigest);
  t.is(mtimeAfter, mtimeBefore);
});

test('precomputed cacheKey is used by OgImage', (t) => {
  const data = { page: { url: '/x/' }, title: 'X' };
  const cacheKey = buildCacheKey('./test/og-test.og.njk', data, 'abc', 1);
  const ogImage = fixtureOgImage({ data, cacheKey });

  t.is(ogImage.getCacheKey(), cacheKey);
});
