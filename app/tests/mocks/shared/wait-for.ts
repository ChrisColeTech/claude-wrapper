/**
 * Polls `condition` every few milliseconds until it holds; rejects after `timeoutMs`. For
 * effects a test cannot await directly (a child process exiting, a line reaching a stdin).
 */
export async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor: the condition never held');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
