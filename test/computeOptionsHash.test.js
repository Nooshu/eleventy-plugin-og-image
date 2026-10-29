import test from 'ava';
import { computeOptionsHash, prepareOptionsForHash } from '../src/utils/index.js';

test('computeOptionsHash is stable for identical options', (t) => {
  const satoriOptions = { width: 1200, height: 630, fonts: [] };
  const sharpOptions = { quality: 80 };

  t.is(computeOptionsHash(satoriOptions, sharpOptions), computeOptionsHash(satoriOptions, sharpOptions));
});

test('computeOptionsHash changes when options change', (t) => {
  t.not(
    computeOptionsHash({ width: 1200, height: 630 }, undefined),
    computeOptionsHash({ width: 1200, height: 631 }, undefined),
  );
});

test('computeOptionsHash replaces font data buffers with digests', (t) => {
  const fontData = Buffer.from('font-binary');
  const withFont = computeOptionsHash(
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }],
    },
    undefined,
  );

  t.false(withFont.includes('font-binary'));
  t.regex(withFont, /[a-f0-9]{64}/);
});

test('prepareOptionsForHash memoizes sorted option shapes', (t) => {
  const satoriOptions = {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: Buffer.from('font'), weight: 700, style: 'normal' }],
  };

  const prepared = prepareOptionsForHash(satoriOptions, { quality: 80 });

  t.deepEqual(Object.keys(prepared.satori), ['fonts', 'height', 'width']);
  t.deepEqual(Object.keys(prepared.sharp), ['quality']);
  t.is(computeOptionsHash(satoriOptions, { quality: 80 }, prepared), computeOptionsHash(satoriOptions, { quality: 80 }));
});

test('prepareOptionsForHash handles undefined options and nested non-buffer values', (t) => {
  const prepared = prepareOptionsForHash(undefined, undefined);

  t.deepEqual(prepared, { satori: {}, sharp: {} });

  const nested = prepareOptionsForHash(
    {
      width: 10,
      nested: { value: 'x', list: ['a', { y: 1 }] },
    },
    { progressive: true },
  );

  t.is(nested.satori.width, 10);
  t.is(nested.satori.nested.value, 'x');
  t.true(nested.sharp.progressive);
});

test('computeOptionsHash matches legacy hash input for default options', (t) => {
  const satoriOptions = { width: 1200, height: 630, fonts: [] };

  t.is(
    computeOptionsHash(satoriOptions, undefined),
    `${JSON.stringify({ fonts: {}, height: 630, width: 1200 })}${JSON.stringify({})}`,
  );
});

test('computeOptionsHash uses prepared options when provided', (t) => {
  const prepared = {
    satori: { width: 1 },
    sharp: { quality: 1 },
  };

  t.is(computeOptionsHash({ width: 999 }, { quality: 999 }, prepared), `${JSON.stringify({ width: 1 })}${JSON.stringify({ quality: 1 })}`);
});
