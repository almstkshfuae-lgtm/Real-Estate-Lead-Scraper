/**
 * Safe JSON parsing from a fetch Response.
 *
 * Avoids the infinite-spinner bug where `res.json()` throws on
 * non-JSON responses (e.g. HTML 502 pages from proxies) and the
 * exception bypasses the expected error-handling path.
 */
export async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    // Surface the raw body (truncated) when the response isn't valid JSON.
    const preview = text.length > 200 ? text.slice(0, 200) + '…' : text;
    throw new Error(
      `Server returned non-JSON response (HTTP ${res.status}): ${preview}`,
    );
  }
}

/**
 * Safe JSON parsing for raw string values stored in database columns.
 *
 * Unlike `safeJson` (which handles HTTP Response bodies), this utility is
 * intended for server-side use when deserialising Text/String DB fields that
 * were serialised with `JSON.stringify()`.
 *
 * Behaviour:
 * - If `value` is already an object/array, it is returned as-is.
 * - If `value` is a valid JSON string, the parsed result is returned.
 * - If `value` is a malformed JSON string, `fallback` is returned and a
 *   warning is emitted — the route will NOT crash with a 500 error.
 *
 * @param value    The raw value from the database field.
 * @param fallback The safe default to use when parsing fails (default: `null`).
 * @param context  An optional label used in the warning log for easier debugging.
 */
export function safeParseJson<T = any>(
  value: unknown,
  fallback: T = null as unknown as T,
  context?: string,
): T {
  if (typeof value !== 'string') {
    // Already an object, array, null, etc. — return directly.
    return (value ?? fallback) as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch (err) {
    const preview = value.length > 120 ? value.slice(0, 120) + '…' : value;
    console.warn(
      `[safeParseJson] Malformed JSON${context ? ` in "${context}"` : ''}: ${preview}`,
      err,
    );
    return fallback;
  }
}
