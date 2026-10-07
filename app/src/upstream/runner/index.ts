/**
 * The upstream runner (spec section 16): `startRun(spec) → Run`, with two adapters, the spawn
 * runner (the real CLI) and the replay runner (a recorded run).
 */
export type {
  Run, Runner, RunDirectory, RunEndpoint, RunExit, RunFailureReason, RunSpec, RunTimerName, RunTimers, UserMessage
} from './types';
export { RunFailure } from './run-failure';
export { RESULT_WAIT_MS } from './run';
export { createSpawnRunner } from './spawn-runner';
export { withRunFile } from './run-directory';
export type { SpawnFunction, SpawnRunnerOptions } from './spawn-runner';
export { createReplayRunner } from './replay-runner';
export type { ReplayedRun, ReplayOptions, ReplayRunner } from './replay-runner';
export { parseRecording } from './recording';
export type { Recording, RecordingEvent } from './recording';
