/**
 * Parking (spec section 7, ADR 0001): a parked run is registered under every `tool_use` id its
 * turn returned, so the next request's `tool_result` ids find it; it is held until a request's
 * results complete its park, until the park TTL expires (then it is abandoned: the run is
 * interrupted before its waiting calls are rejected), or until the run ends on its own. A partial
 * answer leaves it parked, its TTL still running.
 */
import { createParking, HeldOpen, Parking } from '../../../../src/anthropic/conductor/parking';
import { ParkedRuns } from '../../../../src/anthropic/sessions';
import { DeliverOutcome, ToolResultBlock } from '../../../../src/upstream/bridge';
import { memorySessions } from '../../../mocks/anthropic/sessions';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';

const TTL_MS = 600_000;
const QUIET = { debug: () => undefined, info: () => undefined, warn: () => undefined };
const result = (id: string): ToolResultBlock => ({ type: 'tool_result', tool_use_id: id, content: 'ok' });

interface FakeRun extends HeldOpen {
  abandoned: string[];
  delivered: ToolResultBlock[][];
  exit(): void;
}

/** A held-open run whose bridge resumes once every one of its ids has a result. */
function heldRun(toolUseIds: string[], runId = 'run-1'): FakeRun {
  let exit: () => void = () => undefined;
  const abandoned: string[] = [];
  const delivered: ToolResultBlock[][] = [];
  return {
    runId, toolUseIds, abandoned, delivered,
    exited: new Promise<void>(resolve => { exit = resolve; }),
    exit: () => exit(),
    async abandon(reason) { abandoned.push(reason); },
    deliver(results): DeliverOutcome {
      delivered.push(results);
      const ids = results.map(block => block.tool_use_id);
      const stillMissing = toolUseIds.filter(id => !ids.includes(id));
      return stillMissing.length > 0 ? { status: 'partial', stillMissing } : { status: 'resumed' };
    }
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('parking', () => {
  let clock: FakeClock;
  let registry: ParkedRuns;
  let parking: Parking<FakeRun>;

  beforeEach(() => {
    clock = createFakeClock();
    registry = memorySessions(clock).sessions.parked;
    parking = createParking<FakeRun>({ registry, clock, ttlMs: TTL_MS, logger: QUIET });
  });

  it('registers a parked run under each of its tool_use ids', () => {
    const run = heldRun(['toolu_1', 'toolu_2']);

    parking.park(run);

    expect(registry.get('toolu_1')).toBe(run);
    expect(registry.get('toolu_2')).toBe(run);
  });

  it('hands back the run once a request’s results complete its park, and holds it no longer', () => {
    const run = heldRun(['toolu_1', 'toolu_2']);
    parking.park(run);

    const delivery = parking.deliver(run, [result('toolu_2'), result('toolu_1')]);

    expect(delivery).toEqual({ status: 'resumed', run });
    expect(registry.get('toolu_1')).toBeUndefined();
    clock.advance(TTL_MS);
    expect(run.abandoned).toEqual([]);
  });

  it('leaves the run parked on a partial answer, its park TTL still running', () => {
    const run = heldRun(['toolu_1', 'toolu_2']);
    parking.park(run);

    expect(parking.deliver(run, [result('toolu_1')])).toEqual({ status: 'partial', stillMissing: ['toolu_2'] });
    expect(registry.get('toolu_2')).toBe(run);
    clock.advance(TTL_MS);
    expect(run.abandoned).toEqual(['park TTL expired']);
  });

  it('abandons the run when its park TTL expires, after which its ids find nothing', () => {
    const run = heldRun(['toolu_1']);
    parking.park(run);

    clock.advance(TTL_MS - 1);
    expect(run.abandoned).toEqual([]);
    clock.advance(1);

    expect(run.abandoned).toEqual(['park TTL expired']);
    expect(registry.get('toolu_1')).toBeUndefined();
    expect(parking.deliver(run, [result('toolu_1')])).toEqual({ status: 'unknown', unknownIds: ['toolu_1'] });
    expect(run.delivered).toEqual([]);
  });

  it('drops a run that ends while parked, abandoning what is left of it', async () => {
    const run = heldRun(['toolu_1']);
    parking.park(run);

    run.exit();
    await flush();

    expect(registry.get('toolu_1')).toBeUndefined();
    expect(run.abandoned).toEqual(['the run ended while parked']);
    clock.advance(TTL_MS);
    expect(run.abandoned).toHaveLength(1);
  });

  it('keeps each park to itself', () => {
    const first = heldRun(['toolu_1'], 'run-1');
    const second = heldRun(['toolu_2'], 'run-2');
    parking.park(first);
    clock.advance(TTL_MS / 2);
    parking.park(second);

    clock.advance(TTL_MS / 2);

    expect(first.abandoned).toEqual(['park TTL expired']);
    expect(second.abandoned).toEqual([]);
    expect(parking.deliver(second, [result('toolu_2')])).toEqual({ status: 'resumed', run: second });
  });
});
