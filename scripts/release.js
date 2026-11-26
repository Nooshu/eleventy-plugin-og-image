import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpSemver, formatChangelogSection, parseReleaseArgs, prependChangelog } from './lib/semver.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileSyncOptionsWithStringEncoding} [options]
 */
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function assertCleanWorkingTree() {
  const status = run('git', ['status', '--porcelain']).trim();

  if (status) {
    throw new Error('Working tree is not clean. Commit or stash changes before releasing.');
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function repoHttpsUrl() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const raw = packageJson.repository?.url || '';

  return String(raw)
    .replace(/^git\+/, '')
    .replace(/\.git$/, '');
}

/**
 * @param {string} previousVersion
 * @param {string[]} explicitNotes
 * @returns {string[]}
 */
function collectNotes(previousVersion, explicitNotes) {
  if (explicitNotes.length > 0) {
    return explicitNotes;
  }

  try {
    const log = run('git', ['log', `v${previousVersion}..HEAD`, '--pretty=format:%s']).trim();

    return log
      ? log
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function originNameWithOwner() {
  const remoteUrl = run('git', ['remote', 'get-url', 'origin']).trim();
  const match = remoteUrl.match(/[:/]([^/]+\/[^/.]+)(?:\.git)?$/);

  if (!match) {
    throw new Error(`Could not parse origin remote URL: ${remoteUrl}`);
  }

  return match[1];
}

function createGitHubRelease(tag, notes) {
  const nameWithOwner = originNameWithOwner();
  const releaseBody = notes.length > 0 ? notes.map((note) => `- ${note}`).join('\n') : `Release ${tag}`;
  const payload = JSON.stringify({
    tag_name: tag,
    name: tag,
    body: releaseBody,
    draft: false,
    prerelease: false,
  });

  execFileSync('gh', ['api', `repos/${nameWithOwner}/releases`, '-X', 'POST', '--input', '-'], {
    cwd: rootDir,
    input: payload,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

function main() {
  const { bump, dryRun, notes: explicitNotes } = parseReleaseArgs(process.argv.slice(2));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const previousVersion = packageJson.version;
  const nextVersion = bumpSemver(previousVersion, bump);
  const tag = `v${nextVersion}`;
  const repoUrl = repoHttpsUrl();
  const notes = collectNotes(previousVersion, explicitNotes);
  const changelogSection = formatChangelogSection({
    version: nextVersion,
    previousVersion,
    repoUrl,
    date: today(),
    notes,
  });

  console.log(`Release plan: ${previousVersion} -> ${nextVersion} (${bump})`);
  console.log(`Tag: ${tag}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('Notes:');
  notes.forEach((note) => console.log(`  - ${note}`));

  if (dryRun) {
    console.log('\nDry run complete. No files or git state were changed.');

    return;
  }

  assertCleanWorkingTree();

  console.log('\nRunning lint...');
  run('npm', ['run', 'lint'], { stdio: 'inherit' });

  console.log('\nRunning tests...');
  run('npm', ['test'], { stdio: 'inherit' });

  packageJson.version = nextVersion;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const changelog = readFileSync(changelogPath, 'utf8');
  writeFileSync(changelogPath, prependChangelog(changelog, changelogSection));

  run('git', ['add', 'package.json', 'CHANGELOG.md']);
  run('git', ['commit', '-m', `chore(release): ${nextVersion}`]);
  run('git', ['tag', tag]);
  run('git', ['push']);
  run('git', ['push', 'origin', tag]);
  createGitHubRelease(tag, notes);

  console.log(`\nReleased ${tag}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
