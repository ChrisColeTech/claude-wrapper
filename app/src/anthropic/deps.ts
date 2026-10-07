/**
 * The Anthropic surface's injected dependencies (spec section 16, composition root),
 * passed through `createServer(deps)`. The OpenAI surface takes none.
 *
 * Every slot is optional: the composition root gives an omitted slot its production
 * implementation. A test injects what it needs (`tests/mocks/anthropic/surface-harness.ts`).
 */
import { Clock } from '../utils/clock';
import { ControlServer } from '../upstream/control-server';
import { ResolveHost } from '../upstream/hook-policy';
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
  /**
   * Defaults to a loopback control server of the surface's own, started by the first turn that
   * mounts a bridge server (tests inject one and close it).
   */
  controlServer?: ControlServer;
  /** Defaults to `systemClock`; tests pass a fake clock (`tests/mocks/shared/fake-clock.ts`). */
  clock?: Clock;
  /**
   * The working and per-run directories. Defaults to the process's own state directory, opened
   * once per process at the wrapper's start, else at the first turn (opening one empties it).
   * Tests with the replay runner pass plain paths; nothing is created on disk for them.
   */
  stateDirectory?: StateDirectory;
  /**
   * The CLI account file read once at startup to arm redaction. Defaults to the one the runs'
   * CLI reads (`.claude.json` under `upstream.env`'s `CLAUDE_CONFIG_DIR`, else the home directory).
   */
  accountFile?: string;
  /**
   * Resolves a WebFetch URL's host name as its call is decided, so that a fetch reaches only public
   * addresses (unless the operator turned that off). Defaults to the system resolver; tests inject
   * a table (`tests/mocks/anthropic/surface-harness.ts` gives one that resolves nothing).
   */
  resolveHost?: ResolveHost;
}
