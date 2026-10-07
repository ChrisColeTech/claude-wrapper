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

/** Placeholder until the upstream runner (ticket 27): `startRun(spec) → Run`. */
export interface Runner {
  startRun(spec: unknown): unknown;
}

/** Placeholder until the catalogue (ticket 25): `resolve(name) → entry | null`, `list(page)`. */
export interface Catalogue {
  resolve(name: string): unknown;
  list(page: unknown): unknown;
}

/** Placeholder until conversation state (ticket 31): `lookup`, `record`, `forget`; `parked` comes with it. */
export interface Sessions {
  lookup(fingerprint: string): unknown;
  record(entry: unknown): unknown;
  forget(sessionId: string): unknown;
}

/** Placeholder until the control server (ticket 33): `start() → {baseUrl}`, `registerRun`, `releaseRun`. */
export interface ControlServer {
  start(): unknown;
  registerRun(id: string, handlers: unknown): unknown;
  releaseRun(id: string): unknown;
}

export interface SurfaceDeps {
  runner?: Runner;
  catalogue?: Catalogue;
  sessions?: Sessions;
  controlServer?: ControlServer;
  /** Defaults to `systemClock`; tests pass a fake clock (`tests/mocks/shared/fake-clock.ts`). */
  clock?: Clock;
}
