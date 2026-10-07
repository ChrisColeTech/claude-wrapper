/**
 * The run's frames as one shared async iterator: frames queue until read, the end or a failure
 * is delivered after the last queued frame, and leaving a `for await` early does not end it.
 */

export interface FrameQueue<T> extends AsyncIterable<T> {
  push(item: T): void;
  end(): void;
  fail(error: Error): void;
}

type Waiter<T> = { resolve: (result: IteratorResult<T>) => void; reject: (error: Error) => void };

export function createFrameQueue<T>(): FrameQueue<T> {
  const items: T[] = [];
  const waiters: Waiter<T>[] = [];
  let ended = false;
  let failure: Error | undefined;

  const settleWaiters = (): void => {
    while (waiters.length > 0 && (items.length > 0 || ended)) {
      const waiter = waiters.shift() as Waiter<T>;
      if (items.length > 0) waiter.resolve({ value: items.shift() as T, done: false });
      else if (failure) waiter.reject(failure);
      else waiter.resolve({ value: undefined, done: true });
    }
  };

  const next = (): Promise<IteratorResult<T>> => new Promise((resolve, reject) => {
    waiters.push({ resolve, reject });
    settleWaiters();
  });

  const iterator: AsyncIterator<T> = {
    next,
    return: async () => ({ value: undefined, done: true })
  };

  return {
    push(item) {
      if (ended) return;
      items.push(item);
      settleWaiters();
    },
    end() {
      ended = true;
      settleWaiters();
    },
    fail(error) {
      if (ended) return;
      failure = error;
      ended = true;
      settleWaiters();
    },
    [Symbol.asyncIterator]: () => iterator
  };
}
