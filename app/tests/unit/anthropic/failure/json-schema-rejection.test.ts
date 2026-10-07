/**
 * Upstream's startup rejection of `--json-schema` (spec sections 10 and 12): the CLI checks the
 * schema before any API call and exits 1 with one `Error: --json-schema ...` line on stderr. The
 * schema is the client's `output_config.format.schema`, so that exit is a 400 the client can act
 * on, never the 500 an unexplained exit maps to. The recorded case is `l-parse-errors.txt`; the
 * other two lines are the binary's own message strings (2.1.291).
 */
import * as fs from 'fs';
import * as path from 'path';
import { createFailureReader } from '../../../../src/anthropic/failure';
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { UPSTREAM_FIXTURES } from '../../../mocks/upstream/recordings';

const exitWith = (stderr: string, code: number | null = 1): SurfaceError =>
  createFailureReader().errorFor({ kind: 'exit', exit: { code, signal: null, stderr } });

const shape = (error: SurfaceError) =>
  ({ status: error.status, type: error.type, message: error.message, retryable: error.retryable });

/** The stderr of the recorded `--json-schema {not json` run. */
function recordedRejection(): string {
  const text = fs.readFileSync(path.join(UPSTREAM_FIXTURES, 'cli-probes', 'l-parse-errors.txt'), 'utf8');
  const run = text.split('### ').find(section => section.includes('--json-schema')) as string;
  return run.slice(run.indexOf('--- stderr:') + '--- stderr:'.length).trim();
}

describe('the --json-schema startup rejection', () => {
  it.each([
    [recordedRejection(), "output_config.format.schema is not valid JSON: JSON Parse error: Expected '}'"],
    ['Error: --json-schema must be a JSON object\n', 'output_config.format.schema must be a JSON object'],
    [
      'Error: --json-schema is not a valid JSON Schema: data/properties/word/type must be equal to one of the allowed values\n',
      'output_config.format.schema is not a valid JSON Schema: data/properties/word/type must be equal to one of the allowed values'
    ]
  ])('is a 400 naming the client field: %p', (stderr, message) => {
    expect(shape(exitWith(stderr))).toEqual({ status: 400, type: 'invalid_request_error', message, retryable: false });
  });

  it('is found among other stderr lines', () => {
    const stderr = 'Warning: something unrelated\nError: --json-schema must be a JSON object\n';

    expect(exitWith(stderr).message).toBe('output_config.format.schema must be a JSON object');
  });

  it('leaves any other exit to the upstream failure table', () => {
    expect(shape(exitWith('Error: Invalid session ID. Must be a valid UUID.\n'))).toEqual({
      status: 500, type: 'api_error', message: 'upstream exited with code 1', retryable: true
    });
  });
});
