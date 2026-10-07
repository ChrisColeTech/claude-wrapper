/**
 * Upstream's startup rejection of `--json-schema` (spec sections 10 and 12): the CLI checks the
 * schema before any API call and exits 1 with one `Error: --json-schema <reason>` line on stderr
 * ("is not valid JSON: …", "must be a JSON object", "is not a valid JSON Schema: …"). The schema
 * is the client's `output_config.format.schema`, so the exit is a 400 naming that field.
 */
import { SurfaceError } from '../http/surface-error';

const REJECTION = /^Error: --json-schema (.+)$/m;

/** The 400 for a run that `stderr` shows upstream refused to start over the schema, else null. */
export function jsonSchemaRejection(stderr: string): SurfaceError | null {
  const reason = REJECTION.exec(stderr)?.[1]?.trim();
  return reason ? SurfaceError.invalidRequest(`output_config.format.schema ${reason}`) : null;
}
