import { execSync } from 'node:child_process';

export type ChangelogEntry = {
  tag: string;
  date: string;
  message: string;
};

/** Reads annotated git tags for the public changelog page. */
export function getChangelogEntries(): ChangelogEntry[] {
  try {
    const output = execSync('git tag --sort=-creatordate', { encoding: 'utf8' }).trim();
    if (!output) return [];
    const tags = output.split('\n').filter(Boolean);
    return tags.map((tag) => {
      let date = '';
      let message = tag;
      try {
        date = execSync(`git log -1 --format=%cs ${tag}`, { encoding: 'utf8' }).trim();
        message =
          execSync(`git tag -l --format="%(contents:subject)" ${tag}`, {
            encoding: 'utf8',
          }).trim() || tag;
      } catch {
        // Tag may exist without annotation — keep defaults.
      }
      return { tag, date, message };
    });
  } catch {
    return [];
  }
}
