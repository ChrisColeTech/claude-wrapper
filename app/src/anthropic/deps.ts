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
import { Sessions } from './sessions';

export type { Catalogue } from './catalogue';

/** The upstream runner: `startRun(spec) → Run` (the spawn runner in production, replay in tests). */
export type { Runner };

/** The fingerprint map (`lookup`, `record`, `forget`) and the parked-run registry (`parked`). */
export type { Sessions };

/** The loopback control server each run registers its bridge server and hook endpoint with. */
export type { ControlServer };

export interface SurfaceDeps {
  /** Defaults to the spawn runner (the operator's Claude Code, `CLAUDE_COMMAND`). */
  runner?: Runner;
  /** Defaults to the catalogue file the operator's settings name, else the shipped one. */
  catalogue?: Catalogue;
  /**
   * Defaults to an empty in-memory map with the operator's capacity and expiry, deleting upstream
   * transcripts under the state directory's project.
   */
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
  /**
   * The CLI account file read once at startup to arm redaction. Defaults to the one the runs'
   * CLI reads (`.claude.json` under `upstream.env`'s `CLAUDE_CONFIG_DIR`, else the home directory).
   */
  accountFile?: string;
}
