/**
 * @param {string} version
 * @returns {{ major: number; minor: number; patch: number }}
 */
export function parseSemver(version) {
  const match = String(version)
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version "${version}". Expected MAJOR.MINOR.PATCH`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * @param {string} version
 * @param {'major' | 'minor' | 'patch'} bump
 * @returns {string}
 */
export function bumpSemver(version, bump) {
  const parsed = parseSemver(version);

  if (bump === 'major') {
    return `${parsed.major + 1}.0.0`;
  }

  if (bump === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }

  if (bump === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  throw new Error(`Unknown bump type "${bump}". Use major, minor, or patch.`);
}

/**
 * @param {object} args
 * @param {string} args.version
 * @param {string} args.previousVersion
 * @param {string} args.repoUrl
 * @param {string} args.date
 * @param {string[]} args.notes
 * @returns {string}
 */
export function formatChangelogSection({ version, previousVersion, repoUrl, date, notes }) {
  const compareUrl = `${repoUrl}/compare/v${previousVersion}...v${version}`;
  const body = notes.length > 0 ? notes.map((note) => `* ${note}`).join('\n') : '* Release updates';

  return `## [${version}](${compareUrl}) (${date})\n\n\n${body}\n`;
}

/**
 * @param {string} changelog
 * @param {string} section
 * @returns {string}
 */
export function prependChangelog(changelog, section) {
  const trimmed = changelog.replace(/^\uFEFF?/, '');

  if (!trimmed.trim()) {
    return `${section}\n`;
  }

  return `${section}\n${trimmed.replace(/^\n+/, '')}`;
}

/**
 * @param {string[]} argv
 * @returns {{ bump: 'major' | 'minor' | 'patch'; dryRun: boolean; notes: string[] }}
 */
export function parseReleaseArgs(argv) {
  const args = [...argv];
  let dryRun = false;
  /** @type {string[]} */
  const notes = [];
  /** @type {'major' | 'minor' | 'patch' | undefined} */
  let bump;

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--notes') {
      const note = args.shift();

      if (!note) {
        throw new Error('--notes requires a value');
      }

      notes.push(note);
    } else if (arg === 'major' || arg === 'minor' || arg === 'patch') {
      bump = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!bump) {
    throw new Error('Usage: npm run release -- <major|minor|patch> [--dry-run] [--notes "text"]');
  }

  return { bump, dryRun, notes };
}
