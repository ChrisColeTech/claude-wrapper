/**
 * The Anthropic surface's injected dependencies (spec section 16, composition root),
 * passed through `createServer(deps)`. The OpenAI surface takes none.
 *
 * Every slot is optional: an omitted slot gets its production implementation once the
 * ticket that owns it lands. Until then each slot's type is a placeholder holding the
 * spec's method names; the owning ticket replaces the placeholder with its real interface
 * (re-exported or imported here) and leaves the slot name and `createServer`'s signature alone.
 */
import { Clock } from '../utils/clock';
import { ControlServer } from '../upstream/control-server';
import { Runner } from '../upstream/runner';
import { StateDirectory } from '../upstream/state-directory';
import { Catalogue } from './catalogue';

export type { Catalogue } from './catalogue';

/** The upstream runner: `startRun(spec) → Run` (the spawn runner in production, replay in tests). */
export type { Runner };

/** Placeholder until conversation state (ticket 31): `lookup`, `record`, `forget`; `parked` comes with it. */
export interface Sessions {
  lookup(fingerprint: string): unknown;
  record(entry: unknown): unknown;
  forget(sessionId: string): unknown;
}

/** The loopback control server each run registers its bridge server and hook endpoint with. */
export type { ControlServer };

export interface SurfaceDeps {
  /** Defaults to the spawn runner (the operator's Claude Code, `CLAUDE_COMMAND`). */
  runner?: Runner;
  /** Defaults to the catalogue file the operator's settings name, else the shipped one. */
  catalogue?: Catalogue;
  sessions?: Sessions;
  /** Not defaulted yet: its first reader (the conductor) defaults it and awaits `start()` first. */
  controlServer?: ControlServer;
  /** Defaults to `systemClock`; tests pass a fake clock (`tests/mocks/shared/fake-clock.ts`). */
  clock?: Clock;
  /**
   * The working and per-run directories. Defaults to the process's own state directory, opened
   * once per process at the first turn (opening one empties it). Tests with the replay runner
   * pass plain paths; nothing is created on disk for them.
   */
  stateDirectory?: StateDirectory;
}
