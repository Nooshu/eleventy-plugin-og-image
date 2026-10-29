import test from 'ava';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchBundledUndici } from '../scripts/patch-bundled-undici.js';

const scriptPath = fileURLToPath(new URL('../scripts/patch-bundled-undici.js', import.meta.url));

async function createPackageDir(root, name, version) {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'undici', version }), 'utf8');
  await fs.writeFile(path.join(dir, 'marker.txt'), version, 'utf8');

  return dir;
}

test('patchBundledUndici skips when either path is missing', (t) => {
  t.is(
    patchBundledUndici({
      nestedPath: path.join(os.tmpdir(), `missing-nested-${process.pid}`),
      hoistedPath: path.join(os.tmpdir(), `missing-hoisted-${process.pid}`),
    }),
    'skipped',
  );
});

test('patchBundledUndici reports already-current when versions match', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-undici-same-'));
  t.teardown(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const nestedPath = await createPackageDir(root, 'nested', '6.29.1');
  const hoistedPath = await createPackageDir(root, 'hoisted', '6.29.1');

  t.is(patchBundledUndici({ nestedPath, hoistedPath }), 'already-current');
});

test('patchBundledUndici replaces nested package when versions differ', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-undici-diff-'));
  t.teardown(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const nestedPath = await createPackageDir(root, 'nested', '6.29.0');
  const hoistedPath = await createPackageDir(root, 'hoisted', '6.29.1');

  t.is(patchBundledUndici({ nestedPath, hoistedPath }), 'patched');
  t.is(JSON.parse(await fs.readFile(path.join(nestedPath, 'package.json'), 'utf8')).version, '6.29.1');
  t.is(await fs.readFile(path.join(nestedPath, 'marker.txt'), 'utf8'), '6.29.1');
});

test('patchBundledUndici uses default node_modules paths', (t) => {
  const result = patchBundledUndici();

  t.true(['patched', 'skipped', 'already-current'].includes(result));
});

test('CLI entrypoint exits successfully', (t) => {
  const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });

  t.is(result.status, 0, result.stderr);
});
