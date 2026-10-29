import test from 'ava';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OgImage } from '../src/OgImage.js';
import { testConstructor } from './utils/testConstructor.js';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('vendored sprintf-js clamps unbounded precision instead of throwing', (t) => {
  const { sprintf } = require('../vendor/sprintf-js/src/sprintf.js');

  t.is(sprintf('%.2f', Math.PI), '3.14');
  t.notThrows(() => sprintf('%.999999f', 1.25));
  t.notThrows(() => sprintf('%.999999e', 1.25));
  t.notThrows(() => sprintf('%.999999g', 1.25));
});

test('fflate override resolves to the patched 0.7.5 release', (t) => {
  const fflateEntryPath = require.resolve('fflate');
  const packageJsonPath = path.join(path.dirname(fflateEntryPath), '..', 'package.json');
  const fflatePackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  t.is(fflatePackage.version, '0.7.5');
  t.false(fflateEntryPath.includes(`${path.sep}satori${path.sep}node_modules${path.sep}fflate`));
});

test('undici installs are patched to 6.29.1 (including npm-bundled copy)', (t) => {
  const undiciPackagePaths = [
    path.join(rootDir, 'node_modules/undici/package.json'),
    path.join(rootDir, 'node_modules/npm/node_modules/undici/package.json'),
  ].filter((packageJsonPath) => existsSync(packageJsonPath));

  t.true(undiciPackagePaths.length > 0);

  undiciPackagePaths.forEach((packageJsonPath) => {
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    t.is(version, '6.29.1', packageJsonPath);
  });

  const lockfile = JSON.parse(readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
  Object.entries(lockfile.packages)
    .filter(([lockPath]) => lockPath.endsWith('/undici') || lockPath === 'node_modules/undici')
    .forEach(([lockPath, meta]) => {
      t.is(meta.version, '6.29.1', lockPath);
    });
});

test('OG image render remains stable with security overrides applied', async (t) => {
  const ogImage = new OgImage(testConstructor);
  const pngBuffer = await ogImage.pngBuffer();
  const digest = createHash('sha256').update(pngBuffer).digest('hex');

  t.true(pngBuffer instanceof Buffer);
  t.true(pngBuffer.length > 0);
  t.regex(digest, /^[a-f0-9]{64}$/);

  // Deterministic output for the fixture template
  t.is(digest, createHash('sha256').update(await new OgImage(testConstructor).pngBuffer()).digest('hex'));
});
