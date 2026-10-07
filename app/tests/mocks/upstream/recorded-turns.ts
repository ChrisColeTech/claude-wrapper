/**
 * One turn of a `frames` recording that holds several: a probe that sent one user message after
 * another over a held-open stdin (`o-pass-through-run1` sent six). A turn is the frames from its
 * `system/init` up to the next one, and turns are numbered from 1, as the fixture's research
 * notes number the messages. Read straight from the file, as stdout values (an oracle), as frames
 * (the translator's input) or as a recording of its own for the replay runner.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame, parseFrame } from '../../../src/upstream/frames';
import { parseRecording, Recording } from '../../../src/upstream/runner';
import { UPSTREAM_FIXTURES } from './recordings';

const isInit = (line: string): boolean => {
  const value = JSON.parse(line) as { type?: unknown; subtype?: unknown };
  return value.type === 'system' && value.subtype === 'init';
};

function turnLines(name: string, turn: number): string[] {
  const lines = fs.readFileSync(path.join(UPSTREAM_FIXTURES, name), 'utf8').split('\n').filter(line => line.trim() !== '');
  const starts = lines.flatMap((line, index) => (isInit(line) ? [index] : []));
  const start = starts[turn - 1];
  if (start === undefined) throw new Error(`${name} has no turn ${turn}`);
  return lines.slice(start, starts[turn] ?? lines.length);
}

/** Turn `turn` (from 1) of a fixture, each stdout line parsed straight from the file. */
export function recordedTurnStdout(name: string, turn: number): unknown[] {
  return turnLines(name, turn).map(line => JSON.parse(line));
}

/** Turn `turn` (from 1) of a fixture as the run yields it (each line through `parseFrame`). */
export function recordedTurnFrames(name: string, turn: number): Frame[] {
  return turnLines(name, turn).map(parseFrame);
}

/** Turn `turn` (from 1) of a fixture as a recording of its own: one user message in, its frames out, exit. */
export function recordedTurn(name: string, turn: number): Recording {
  return parseRecording(turnLines(name, turn).join('\n'));
}
