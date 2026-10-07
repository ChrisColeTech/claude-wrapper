/**
 * What every history rendering shares (spec section 5): attribute values are XML-escaped; text
 * never is.
 */
export function attribute(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A tool call as `<tag id="…" name="…">{input as JSON}</tag>`, the block's fields as sent. */
export function callTag(tag: string, block: Readonly<Record<string, unknown>>): string {
  return `<${tag} id="${attribute(block['id'])}" name="${attribute(block['name'])}">${JSON.stringify(block['input'] ?? {})}</${tag}>`;
}
