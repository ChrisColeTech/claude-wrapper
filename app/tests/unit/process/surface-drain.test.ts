/**
 * The wrapper's shutdown (spec section 14) drains the Anthropic surface first: before the HTTP
 * server closes (which waits for the streams in flight), every upstream run goes down the
 * teardown ladder within the drain setting. The shutdown as a whole is given the time its steps
 * may take, so a drain longer than the default 10 s is not cut short by a forced exit, which would
 * leave upstream processes behind.
 */
import { SIGNAL_CONFIG } from '../../../src/config/constants';
import { ISignalHandler, ShutdownStep, SignalHandler } from '../../../src/process/signals';
import { registerSurfaceDrain, SURFACE_DRAIN_MARGIN_MS } from '../../../src/process/surface-drain';

jest.mock('../../../src/process/pid', () => ({ pidManager: { cleanupPidFile: jest.fn() } }));
jest.mock('../../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('the shutdown drains the Anthropic surface', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers the drain as the first step, before the HTTP server closes, bounded by the drain setting', async () => {
    const steps: ShutdownStep[] = [];
    const handler = { registerShutdownStep: (step: ShutdownStep) => steps.push(step) } as unknown as ISignalHandler;
    const drain = jest.fn(async () => undefined);

    registerSurfaceDrain(handler, drain, 15_000);

    expect(steps).toEqual([expect.objectContaining({ name: 'Drain the Anthropic surface', timeout: 15_000 + SURFACE_DRAIN_MARGIN_MS })]);
    expect(steps[0]?.step).toBeLessThan(SIGNAL_CONFIG.SHUTDOWN_STEPS.CLOSE_SERVER);
    await steps[0]?.action();
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('is not cut short by the default 10 s forced exit when the drain takes longer', async () => {
    jest.useFakeTimers();
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const handler = new SignalHandler();
    let finish: () => void = () => undefined;
    registerSurfaceDrain(handler, () => new Promise<void>(resolve => { finish = resolve; }), 15_000);

    const shutdown = handler.initiateShutdown('SIGTERM');
    jest.advanceTimersByTime(14_000);
    expect(exit).not.toHaveBeenCalled();
    finish();
    await shutdown;

    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });
});
