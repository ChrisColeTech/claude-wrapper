/**
 * Waiting helpers for the scheduler: a promise settled from outside, and a bounded wait on the
 * injected clock.
 */
import { Clock } from '../../utils/clock';

export interface Deferred<T = void> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

/** Whether `promise` settled within `ms` on `clock`; its rejection counts as settled. */
export function within(promise: Promise<unknown>, ms: number, clock: Clock): Promise<boolean> {
  return new Promise(resolve => {
    const timer = clock.setTimeout(() => resolve(false), ms);
    const settled = () => {
      clock.clearTimeout(timer);
      resolve(true);
    };
    promise.then(settled, settled);
  });
}
