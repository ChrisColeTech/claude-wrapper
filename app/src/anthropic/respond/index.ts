/**
 * The sinks (spec section 16, respond): the turn stream written as SSE, or accumulated into one
 * `Message` for a non-streaming request. Both take the same `push(event)` and report how the
 * response ended through `outcome`.
 */
export { accumulate } from './accumulate';
export type { Message } from './accumulate';
export { createSseSink } from './sse-sink';
export type { SseSinkOptions } from './sse-sink';
export { createJsonSink } from './json-sink';
export type { SinkEvent, SinkOutcome, TurnSink } from './sink';
