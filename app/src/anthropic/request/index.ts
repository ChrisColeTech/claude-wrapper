/**
 * The request module's interface (spec section 16): `planTurn(request, catalogue, sessions,
 * context) → TurnPlan | SurfaceError`. Inside, one pure file per validation concern, the
 * normaliser, the continuation choice, the replayed-turn renderer and the run spec (argument
 * list, environment allowlist). `fingerprint` is the key a clean turn's transcript is recorded under.
 */
export { planTurn } from './plan-turn';
export { checkUpstreamEnv } from './child-environment';
export { messageToSend, resumedSession } from './continuation';
export { fingerprint } from './fingerprint';
export { changedRunBound } from './run-bound';
export type { RunBound } from './run-bound';
export { withoutIgnoredContent } from './ignored-content';
export type { ClientMessage } from './validate-messages';
export type {
  ContentBlock, Continuation, NormalisedMessage, ParkedContinuation, RunContext, RunContinuation, StartupChecks, TurnPlan
} from './turn-plan';
