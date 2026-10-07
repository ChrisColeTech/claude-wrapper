/**
 * What every history rendering shares (spec section 5): attribute values are XML-escaped; text
 * never is.
 */
export function attribute(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
