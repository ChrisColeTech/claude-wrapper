/**
 * What `planTurn` needs beside the request, for tests: the shipped catalogue, sessions that never
 * match (every turn a replayed turn), and a run context with fixed paths, a fixed run id, the
 * default operator settings and a small parent environment. Nothing here touches the disk.
 */
import { loadCatalogue, SHIPPED_CATALOGUE_PATH } from '../../../src/anthropic/catalogue';
import { Sessions } from '../../../src/anthropic/deps';
import { SurfaceError } from '../../../src/anthropic/http/surface-error';
import { planTurn, RunContext, TurnPlan } from '../../../src/anthropic/request';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../src/config/anthropic-settings';

export const shippedCatalogue = loadCatalogue(SHIPPED_CATALOGUE_PATH);

/** Sessions that never match: every turn is a replayed turn. */
export const NO_SESSIONS: Sessions = {
  lookup: () => null,
  record: () => undefined,
  forget: () => undefined
};

export const STATE = { cwd: '/var/lib/claude-wrapper/cwd', runs: '/var/lib/claude-wrapper/runs' };
export const RUN_ID = 'run-0001';
export const PARENT_ENV = { HOME: '/home/operator', PATH: '/usr/local/bin:/usr/bin', LANG: 'en_US.UTF-8' };

export function runContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    settings: ANTHROPIC_SETTING_DEFAULTS,
    environment: PARENT_ENV,
    state: STATE,
    runId: RUN_ID,
    ...overrides
  };
}

/** `planTurn` with the shipped catalogue, no sessions and the default run context. */
export function planDefault(request: unknown): TurnPlan | SurfaceError {
  return planTurn(request, shippedCatalogue, NO_SESSIONS, runContext());
}

/** The rejection as the client would see it (status, `error.type`, `error.message`); throws on a plan. */
export function rejectionOf(request: unknown): { status: number; type: string; message: string } {
  const result = planDefault(request);
  if (!(result instanceof SurfaceError)) throw new Error('expected a SurfaceError, got a plan');
  return { status: result.status, type: result.type, message: result.message };
}

/** A 400 `invalid_request_error` with this message, in `rejectionOf`'s shape. */
export const invalidRequest = (message: string) => ({ status: 400, type: 'invalid_request_error', message });
