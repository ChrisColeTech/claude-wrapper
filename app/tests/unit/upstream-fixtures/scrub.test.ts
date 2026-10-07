/**
 * Scrubbing one recorded upstream transcript: every live account value becomes
 * its placeholder, wherever and however the recording carries it.
 * The values here are synthetic stand-ins for the operator's account.
 */
import { liveValuesFrom, LiveValues } from '../../scripts/upstream-fixtures/live-values';
import { scrubRecording } from '../../scripts/upstream-fixtures/scrub';

const ACCOUNT = { emailAddress: 'J.Roe@corp.test', displayName: 'Jane', fullName: 'Jane Roe' };

function values(): LiveValues {
  const v = liveValuesFrom(ACCOUNT);
  if (!v) throw new Error('expected live values');
  return v;
}

describe('scrubRecording on plain text', () => {
  it('replaces the email and names with placeholders, ignoring case', () => {
    const text = 'Logged in as j.ROE@CORP.test (Jane Roe); hi JANE.\n';

    const result = scrubRecording(text, values());

    expect(result.text).toBe('Logged in as user@example.invalid (Example User); hi Example User.\n');
    expect(result.replaced).toBe(3);
  });

  it('matches whole words only, so a short name inside another word is left alone', () => {
    const zed = liveValuesFrom({ displayName: 'Zed' }) ?? [];

    expect(scrubRecording('Unauthorized. Ask Zed, zed_x or Zedé: ZED!', zed))
      .toEqual({ text: 'Unauthorized. Ask Example User, zed_x or Zedé: Example User!', replaced: 2 });
  });

  it('finds a value right after a JSON escape in a plain-text line', () => {
    const line = '[  0.00s] -> {"text": "Hi\\nJane\\tj.roe@corp.test\\u00a0Jane"}';

    expect(scrubRecording(line, values())).toEqual({
      text: '[  0.00s] -> {"text": "Hi\\nExample User\\tuser@example.invalid\\u00a0Example User"}',
      replaced: 3,
    });
  });

  it('leaves text without live values byte-identical', () => {
    const text = 'exit 0\r\nnothing here\n';

    expect(scrubRecording(text, values())).toEqual({ text, replaced: 0 });
  });
});

const frame = (event: object): string =>
  JSON.stringify({ type: 'stream_event', event, session_id: 's1', parent_tool_use_id: null });
const textDelta = (index: number, text: string): string =>
  frame({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });
const blockStart = (index: number): string =>
  frame({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });

function deltaTexts(text: string): string[] {
  return text.split('\n').filter(Boolean)
    .map(line => JSON.parse(line) as { event?: { delta?: { text?: string } } })
    .flatMap(f => (typeof f.event?.delta?.text === 'string' ? [f.event.delta.text] : []));
}

describe('scrubRecording on stream-json frames', () => {
  const init = '{"type":"system","subtype":"init","cwd":"/tmp/x","tools":[]}';
  const split = [
    init,
    blockStart(0),
    textDelta(0, 'The email is j.r'),
    textDelta(0, 'oe@co'),
    textDelta(0, 'rp.test, thanks'),
    frame({ type: 'content_block_stop', index: 0 }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'The email is j.roe@corp.test, thanks' }] } }),
    '',
  ].join('\n');

  it('rewrites an address split across text_delta chunks, keeping every delta and line', () => {
    const result = scrubRecording(split, values());
    const lines = result.text.split('\n');

    expect(lines).toHaveLength(8);
    lines.filter(Boolean).forEach(line => expect(() => JSON.parse(line)).not.toThrow());
    expect(deltaTexts(result.text)).toEqual(['The email is user@example.invalid', '', ', thanks']);
    expect(result.text).toContain('"text":"The email is user@example.invalid, thanks"');
    expect(result.replaced).toBe(2);
  });

  it('leaves lines without live values byte-identical', () => {
    const lines = scrubRecording(split, values()).text.split('\n');

    expect(lines[0]).toBe(init);
    expect(lines[1]).toBe(blockStart(0));
  });

  it('keeps separate content blocks as separate streams', () => {
    const text = [blockStart(0), textDelta(0, 'j.roe@'), blockStart(1), textDelta(1, 'corp.test')].join('\n');

    expect(scrubRecording(text, values())).toEqual({ text, replaced: 0 });
  });

  it('is idempotent', () => {
    const once = scrubRecording(split, values()).text;

    expect(scrubRecording(once, values())).toEqual({ text: once, replaced: 0 });
  });
});

describe('scrubRecording on wire logs whose frames are JSON strings', () => {
  const wire = (t: number, line: string): string => JSON.stringify({ t_ms: t, dir: 'out', frame: line });
  const log = [
    JSON.stringify({ t_ms: 0, dir: 'in', frame: '{"type":"user","message":{"role":"user","content":"hi"}}' }),
    wire(10, blockStart(0)),
    wire(11, textDelta(0, 'mail J.Ro')),
    wire(12, textDelta(0, 'e@corp.test')),
    JSON.stringify({ t_ms: 13, dir: 'out', line: '{"type":"result","result":"j.roe@corp.test"}' }),
  ].join('\n');

  it('decodes each frame string, scrubs it, and re-encodes it', () => {
    const lines = scrubRecording(log, values()).text.split('\n');
    const frames = lines.map(l => JSON.parse(l) as { t_ms: number; frame?: string; line?: string })
      .map(w => ({ t: w.t_ms, frame: JSON.parse(w.frame ?? w.line ?? '{}') as Record<string, unknown> }));

    expect(frames.map(f => f.t)).toEqual([0, 10, 11, 12, 13]);
    expect(frames[2]?.frame).toMatchObject({ event: { delta: { text: 'mail user@example.invalid' } } });
    expect(frames[3]?.frame).toMatchObject({ event: { delta: { text: '' } } });
    expect(frames[4]?.frame).toEqual({ type: 'result', result: 'user@example.invalid' });
  });

  it('keeps frames without live values byte-identical', () => {
    const lines = scrubRecording(log, values()).text.split('\n');

    expect(lines[0]).toBe(log.split('\n')[0]);
    expect(lines[1]).toBe(log.split('\n')[1]);
  });
});

describe('scrubRecording on a pretty-printed JSON document', () => {
  it('scrubs the strings and keeps the indentation', () => {
    const summary = JSON.stringify({ name: 'run', prompt: 'Email j.roe@corp.test', marks: [{ t_ms: 1 }] }, null, 2) + '\n';

    const result = scrubRecording(summary, values());

    expect(result.text).toBe(JSON.stringify({ name: 'run', prompt: 'Email user@example.invalid', marks: [{ t_ms: 1 }] }, null, 2) + '\n');
    expect(result.replaced).toBe(1);
  });
});
