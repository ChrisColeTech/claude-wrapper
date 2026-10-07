/**
 * A manually driven Clock for tests: time moves only on advance(ms), which fires every timer
 * falling due inside the advanced window, in due order, with now() reading each timer's due time.
 */
import { Clock, TimerHandle } from '../../../src/utils/clock';

export interface FakeClock extends Clock {
  advance(ms: number): void;
  pendingCount(): number;
}

interface PendingTimer {
  id: number;
  due: number;
  callback: () => void;
}

export function createFakeClock(startMs = 0): FakeClock {
  let current = startMs;
  let nextId = 1;
  let timers: PendingTimer[] = [];

  const takeNextDue = (until: number): PendingTimer | undefined => {
    const due = timers
      .filter(timer => timer.due <= until)
      .sort((a, b) => a.due - b.due || a.id - b.id)[0];
    if (due) {
      timers = timers.filter(timer => timer !== due);
    }
    return due;
  };

  return {
    now: () => current,
    setTimeout: (callback: () => void, ms: number): TimerHandle => {
      const id = nextId++;
      timers.push({ id, due: current + Math.max(0, ms), callback });
      return id;
    },
    clearTimeout: (handle: TimerHandle): void => {
      timers = timers.filter(timer => timer.id !== handle);
    },
    advance: (ms: number): void => {
      const until = current + ms;
      for (let timer = takeNextDue(until); timer; timer = takeNextDue(until)) {
        current = timer.due;
        timer.callback();
      }
      current = until;
    },
    pendingCount: () => timers.length
  };
}
