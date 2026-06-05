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
