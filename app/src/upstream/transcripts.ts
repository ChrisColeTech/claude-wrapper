/**
 * Upstream's own session transcripts (spec sections 5 and 14). Claude Code persists a session as
 * `<config dir>/projects/<project>/<session id>.jsonl`, with a side directory of the same name for
 * what a session spills (subagents, large tool results). The config dir is `CLAUDE_CONFIG_DIR`,
 * else `~/.claude`; the project is the run's working directory, real path, every non-alphanumeric
 * character replaced by `-`, unless `CLAUDE_CODE_PROJECT_DIR_NAME` names it. Every run shares one
 * working directory, so every transcript the wrapper causes lands in one project directory.
 *
 * Paths longer than upstream's project-name limit (200 characters, then a hash) are not
 * reproduced; the wrapper's state directory is far shorter.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { logger as defaultLogger } from '../utils/logger';
import { SESSION_ID, sweepTranscripts } from './transcript-sweep';

export interface TranscriptStore {
  /** Deletes the session's transcript and side directory, if there; never rejects. */
  delete(sessionId: string): Promise<void>;
}

/** The store of every transcript the wrapper's runs leave, which can also be swept (spec section 14). */
export interface TranscriptDirectory extends TranscriptStore {
  /**
   * Deletes every session last written before `before` (epoch ms), or every one without it;
   * returns how many went. Never throws: a failure is logged and counts nothing.
   */
  sweep(before?: number): number;
}

export interface TranscriptLogger {
  warn(message: string, context?: unknown): void;
}

/** The child's own environment: where its home and Claude Code's storage knobs come from. */
export type ChildEnvironment = Readonly<Record<string, string | undefined>>;

function realPath(directory: string): string {
  try {
    return fs.realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}

/** The directory upstream keeps the transcripts of runs in `cwd`, for a child with `env`. */
export function upstreamProjectDirectory(cwd: string, env: ChildEnvironment): string {
  const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(env['HOME'] || os.homedir(), '.claude');
  const project = env['CLAUDE_CODE_PROJECT_DIR_NAME'] || realPath(cwd).replace(/[^a-zA-Z0-9]/g, '-');
  return path.join(path.resolve(cwd, configDir), 'projects', project);
}

/** `directory` is asked at each deletion and sweep: the state directory behind it opens at the first turn. */
export function createTranscriptStore(
  directory: () => string, logger: TranscriptLogger = defaultLogger
): TranscriptDirectory {
  return {
    sweep(before) {
      try {
        return sweepTranscripts(directory(), before);
      } catch (error) {
        logger.warn('Upstream transcripts could not be swept', { error: String(error) });
        return 0;
      }
    },
    async delete(sessionId) {
      if (!SESSION_ID.test(sessionId)) {
        logger.warn('Upstream transcript not deleted: the session id is not one path segment');
        return;
      }
      try {
        const projectDirectory = directory();
        await Promise.all([
          fs.promises.rm(path.join(projectDirectory, `${sessionId}.jsonl`), { force: true }),
          fs.promises.rm(path.join(projectDirectory, sessionId), { recursive: true, force: true })
        ]);
      } catch (error) {
        logger.warn('Upstream transcript could not be deleted', { sessionId, error: String(error) });
      }
    }
  };
}
