/**
 * Sweeping upstream's transcripts (spec section 14). A session's transcript is
 * `<project>/<session id>.jsonl` with a side directory of the same name; the session was last
 * written when the newer of the two was. Synchronous: it runs once at the process's first turn,
 * before any run of the process can write here, and hourly after that.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Upstream's session ids are UUIDs; anything that is not one plain path segment is never a path. */
export const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** The session an entry of the project directory belongs to, if any. */
function sessionOf(entry: fs.Dirent): string | undefined {
  const id = entry.isFile() && entry.name.endsWith('.jsonl') ? entry.name.slice(0, -'.jsonl'.length)
    : entry.isDirectory() ? entry.name : undefined;
  return id !== undefined && SESSION_ID.test(id) ? id : undefined;
}

/** Each session's entries in `directory`, with when it was last written; none when there is no directory. */
function sessionsIn(directory: string): Map<string, { paths: string[]; writtenAt: number }> {
  const sessions = new Map<string, { paths: string[]; writtenAt: number }>();
  if (!fs.existsSync(directory)) return sessions;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const id = sessionOf(entry);
    if (id === undefined) continue;
    const full = path.join(directory, entry.name);
    const session = sessions.get(id) ?? { paths: [], writtenAt: 0 };
    session.paths.push(full);
    session.writtenAt = Math.max(session.writtenAt, fs.statSync(full).mtimeMs);
    sessions.set(id, session);
  }
  return sessions;
}

/**
 * Deletes every session in `directory` last written before `before` (epoch ms), or every one
 * without it. Returns how many sessions went.
 */
export function sweepTranscripts(directory: string, before?: number): number {
  let swept = 0;
  for (const { paths, writtenAt } of sessionsIn(directory).values()) {
    if (before !== undefined && writtenAt >= before) continue;
    paths.forEach(entry => fs.rmSync(entry, { recursive: true, force: true }));
    swept += 1;
  }
  return swept;
}
