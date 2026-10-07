/**
 * A logger whose every line carries the same context (a request id, a run id): the line's own
 * fields are merged over it.
 */
import { Logger } from './logger';

type Level = 'debug' | 'info' | 'warn' | 'error';
type Levels = Partial<Pick<Logger, Level>>;

/** `logger` with `context` on every line, for the levels `logger` has. */
export function withContext<L extends Level>(logger: Pick<Logger, L>, context: object): Pick<Logger, L> {
  const source = logger as Levels;
  const merged = (extra: unknown): object => ({ ...context, ...(extra as object) });
  const wrapped: Levels = {};
  for (const level of ['debug', 'info', 'warn'] as const) {
    const log = source[level];
    if (log) wrapped[level] = (message, extra) => log.call(logger, message, merged(extra));
  }
  const { error } = source;
  if (error) wrapped.error = (message, cause, extra) => error.call(logger, message, cause, merged(extra));
  return wrapped as Pick<Logger, L>;
}
