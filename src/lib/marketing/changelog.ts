import { execSync } from 'node:child_process';

export type ChangelogEntry = {
  tag: string;
  date: string;
  message: string;
};

const COMMIT_LINE = /^([0-9a-f]{7,40})\|(\d{4}-\d{2}-\d{2})\|(.+)$/i;
const FEATURE_OR_FIX = /^(feat|fix)(\([^)]+\))?:/i;

/** Parses `git log --pretty=format:%h|%cs|%s` into changelog rows. */
export function parseCommitLog(output: string): ChangelogEntry[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = COMMIT_LINE.exec(line);
      if (!match) return [];
      const [, hash, date, message] = match;
      if (!hash || !date || !message || !FEATURE_OR_FIX.test(message)) return [];
      return [{ tag: hash, date, message }];
    });
}

function readGit(command: string): string {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function entriesFromTags(): ChangelogEntry[] {
  const output = readGit('git tag --sort=-creatordate');
  if (!output) return [];
  return output
    .split('\n')
    .filter(Boolean)
    .map((tag) => {
      let date = '';
      let message = tag;
      try {
        date = readGit(`git log -1 --format=%cs ${tag}`);
        message = readGit(`git tag -l --format="%(contents:subject)" ${tag}`) || tag;
      } catch {
        // Tag may exist without annotation — keep defaults.
      }
      return { tag, date, message };
    });
}

function entriesFromCommits(): ChangelogEntry[] {
  const output = readGit('git log -30 --pretty=format:%h|%cs|%s');
  return parseCommitLog(output);
}

/** Reads annotated git tags, then recent feat/fix commits if there are no tags. */
export function getChangelog(): {
  source: 'tags' | 'commits' | 'empty';
  entries: ChangelogEntry[];
} {
  try {
    const tagged = entriesFromTags();
    if (tagged.length > 0) return { source: 'tags', entries: tagged };
    const commits = entriesFromCommits();
    if (commits.length > 0) return { source: 'commits', entries: commits };
    return { source: 'empty', entries: [] };
  } catch {
    return { source: 'empty', entries: [] };
  }
}
