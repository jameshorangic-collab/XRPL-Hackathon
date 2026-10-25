export class NotConfiguredError extends Error {
  constructor(service: string) {
    super(`${service} is not configured. The demo can continue without it.`);
    this.name = "NotConfiguredError";
  }
}
export function apiBase(): string {
  const value =
    import.meta.env.VITE_API_BASE_URL?.trim() ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!value) return "";
  const url = new URL(value, window.location.origin);
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      "The public API base URL must not contain credentials, query parameters, or fragments.",
    );
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new Error("Use HTTPS for a remote integration API.");
  return url.toString().replace(/\/$/, "");
}
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  base = apiBase(),
): Promise<T> {
  if (!base) throw new NotConfiguredError("Integration server");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    /underwriting\/assess|reports\/purchases/.test(path) ? 600000 : 15000,
  );
  try {
    const r = await fetch(base + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (r.status === 402)
      throw new Error(
        "Payment requested (HTTP 402). Server-side payment authorization and verified settlement are required.",
      );
    if (!r.ok)
      throw new Error(
        `Integration request failed (HTTP ${r.status}). No successful payment or transaction was recorded.`,
      );
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error(
        "The integration server timed out. Retry the existing job; it keeps the same idempotency key.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
