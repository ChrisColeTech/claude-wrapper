import { createFakeClock } from './fake-clock';

describe('Fake clock', () => {
  it('starts at the given time and moves only when advanced', () => {
    const clock = createFakeClock(1_000);

    expect(clock.now()).toBe(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
  });

  it('fires due timers in due order, each seeing its own due time', () => {
    const clock = createFakeClock();
    const fired: Array<[string, number]> = [];

    clock.setTimeout(() => fired.push(['late', clock.now()]), 300);
    clock.setTimeout(() => fired.push(['early', clock.now()]), 100);
    clock.setTimeout(() => fired.push(['beyond', clock.now()]), 1_000);

    clock.advance(500);

    expect(fired).toEqual([['early', 100], ['late', 300]]);
    expect(clock.now()).toBe(500);
    expect(clock.pendingCount()).toBe(1);
  });

  it('never fires a cleared timer', () => {
    const clock = createFakeClock();
    const callback = jest.fn();

    const handle = clock.setTimeout(callback, 100);
    clock.clearTimeout(handle);
    clock.advance(1_000);

    expect(callback).not.toHaveBeenCalled();
    expect(clock.pendingCount()).toBe(0);
  });

  it('fires a timer scheduled by another timer when it falls inside the advance', () => {
    const clock = createFakeClock();
    const fired: number[] = [];

    clock.setTimeout(() => {
      fired.push(clock.now());
      clock.setTimeout(() => fired.push(clock.now()), 100);
    }, 100);
    clock.advance(250);

    expect(fired).toEqual([100, 200]);
  });
});
