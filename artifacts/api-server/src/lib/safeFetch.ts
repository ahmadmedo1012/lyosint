export async function safeJsonFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number; bodyTimeoutMs?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 6000, bodyTimeoutMs = 3000, ...fetchOptions } = options;
  try {
    const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = await Promise.race([
      res.json(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Body read timeout")), bodyTimeoutMs),
      ),
    ]);
    return body;
  } catch {
    return null;
  }
}
