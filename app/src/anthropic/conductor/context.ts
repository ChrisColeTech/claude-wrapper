/**
 * Small helpers of the conductor's: its logger, the request it answers, what the request asked
 * for, the planner's context for it, how a turn's end is logged, and the sessions a lost park
 * falls back to.
 */
import { Request, Response } from 'express';
import { AnthropicSettings } from '../../config/anthropic-settings';
import { StateDirectory } from '../../upstream/state-directory';
import { isObject } from '../../utils/json-object';
import { Logger } from '../../utils/logger';
import { anthropicBetas } from '../http';
import { RunContext } from '../request';
import { SinkOutcome } from '../respond';
import { Sessions } from '../sessions';

/** What the conductor logs with: every line carries the request's id and its run's. */
export type ConductorLogger = Pick<Logger, 'debug' | 'info' | 'warn'>;

/** One request being answered: where its answer goes, under which request id. */
export interface Exchange {
  req: Request;
  res: Response;
  requestId: string;
}

/** What planning a request reads beside the request itself. */
export interface PlanningDeps {
  settings: AnthropicSettings;
  /** The wrapper's own environment, read once by the composition root. */
  environment: Readonly<Record<string, string | undefined>>;
  stateDirectory: () => StateDirectory;
}

/** The planner's context for `req`'s run `runId`. */
export const planContext = (deps: PlanningDeps, req: Request, runId: string): RunContext => ({
  settings: deps.settings, environment: deps.environment, state: deps.stateDirectory(), runId, betas: anthropicBetas(req)
});

export const wantsStream = (body: unknown): boolean => isObject(body) && body['stream'] === true;

/** How a response ended, for the line that logs the turn's (or the count's) end. */
export const outcomeContext = (outcome: SinkOutcome): object =>
  ('error' in outcome ? { outcome: outcome.kind, errorType: outcome.error.type } : { outcome: outcome.kind });

/** The same sessions with no parked run: what a turn falls back to when its park was lost. */
export const withoutParks = (sessions: Sessions): Sessions => ({
  lookup: fingerprint => sessions.lookup(fingerprint),
  record: (sessionId, fingerprint) => sessions.record(sessionId, fingerprint),
  forget: sessionId => sessions.forget(sessionId),
  parked: { get: () => undefined, put: () => undefined, remove: () => undefined }
});
