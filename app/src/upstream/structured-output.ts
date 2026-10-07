/**
 * Upstream's structured-output tool (spec sections 10 and 12): a run started with
 * `--json-schema` reports this tool in `system/init.tools`, even under `--tools ""`, and answers
 * by calling it once, with the JSON as the tool's input.
 */
export const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput';
