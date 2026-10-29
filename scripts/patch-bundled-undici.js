/**
 * The nested `npm` package (via semantic-release) ships an in-bundle undici
 * that npm overrides cannot replace. Until npm CLI bundles undici >= 6.29.1,
 * copy the overridden hoisted install over the vulnerable bundled copy.
 *
 * @see https://github.com/npm/cli/issues/10163
 * @see https://github.com/advisories/GHSA-xjj6-f33q-929c
 */
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @param {{ nestedPath?: string; hoistedPath?: string }} [paths]
 * @returns {'patched' | 'skipped' | 'already-current'}
 */
export function patchBundledUndici(paths = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const nested = paths.nestedPath ?? path.join(root, 'node_modules/npm/node_modules/undici');
  const hoisted = paths.hoistedPath ?? path.join(root, 'node_modules/undici');

  if (!existsSync(nested) || !existsSync(hoisted)) {
    return 'skipped';
  }

  const nestedVersion = JSON.parse(readFileSync(path.join(nested, 'package.json'), 'utf8')).version;
  const hoistedVersion = JSON.parse(readFileSync(path.join(hoisted, 'package.json'), 'utf8')).version;

  if (nestedVersion === hoistedVersion) {
    return 'already-current';
  }

  rmSync(nested, { recursive: true, force: true });
  cpSync(hoisted, nested, { recursive: true });

  return 'patched';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  patchBundledUndici();
}
