import test from 'ava';
import {
  bumpSemver,
  formatChangelogSection,
  parseReleaseArgs,
  parseSemver,
  prependChangelog,
} from '../scripts/lib/semver.js';

test('parseSemver accepts MAJOR.MINOR.PATCH', (t) => {
  t.deepEqual(parseSemver('1.0.5'), { major: 1, minor: 0, patch: 5 });
});

test('parseSemver rejects prerelease and malformed versions', (t) => {
  t.throws(() => parseSemver('1.0'), { message: /Unsupported version/ });
  t.throws(() => parseSemver('1.0.5-beta.1'), { message: /Unsupported version/ });
});

test('bumpSemver applies major minor and patch bumps', (t) => {
  t.is(bumpSemver('1.2.3', 'major'), '2.0.0');
  t.is(bumpSemver('1.2.3', 'minor'), '1.3.0');
  t.is(bumpSemver('1.2.3', 'patch'), '1.2.4');
});

test('bumpSemver rejects unknown bump types', (t) => {
  t.throws(() => bumpSemver('1.0.0', 'premajor'), { message: /Unknown bump type/ });
});

test('formatChangelogSection matches existing style', (t) => {
  const section = formatChangelogSection({
    version: '1.0.6',
    previousVersion: '1.0.5',
    repoUrl: 'https://github.com/Nooshu/eleventy-plugin-og-image',
    date: '2026-11-26',
    notes: ['speed up cache hits', 'add release script'],
  });

  t.is(
    section,
    `## [1.0.6](https://github.com/Nooshu/eleventy-plugin-og-image/compare/v1.0.5...v1.0.6) (2026-11-26)


* speed up cache hits
* add release script
`,
  );
});

test('formatChangelogSection uses fallback note when empty', (t) => {
  const section = formatChangelogSection({
    version: '1.0.6',
    previousVersion: '1.0.5',
    repoUrl: 'https://github.com/Nooshu/eleventy-plugin-og-image',
    date: '2026-11-26',
    notes: [],
  });

  t.true(section.includes('* Release updates'));
});

test('prependChangelog inserts section at the top', (t) => {
  const next = prependChangelog('## [1.0.5](...)\n', '## [1.0.6](...)\n\n* note\n');

  t.true(next.startsWith('## [1.0.6]'));
  t.true(next.includes('## [1.0.5]'));
});

test('prependChangelog handles empty changelog', (t) => {
  t.is(prependChangelog('   ', '## [1.0.6](...)\n'), '## [1.0.6](...)\n\n');
});

test('parseReleaseArgs reads bump dry-run and notes', (t) => {
  t.deepEqual(parseReleaseArgs(['patch', '--dry-run', '--notes', 'hello']), {
    bump: 'patch',
    dryRun: true,
    notes: ['hello'],
  });
});

test('parseReleaseArgs validates usage', (t) => {
  t.throws(() => parseReleaseArgs([]), { message: /Usage/ });
  t.throws(() => parseReleaseArgs(['patch', '--notes']), { message: /--notes requires a value/ });
  t.throws(() => parseReleaseArgs(['patch', '--weird']), { message: /Unknown argument/ });
});
