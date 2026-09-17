// Per-instance cache: no operational data is persisted to disk or a second database.
export function createSnapshotCache<T>(loader: () => Promise<T>, ttlMs = 300000, now = Date.now) {
  let cached: { value: T; time: number } | undefined;
  let pending: Promise<T> | undefined;
  return async (force = false): Promise<T> => {
    if (pending) return pending;
    // A short shared cooldown also protects Sheets from repeated manual refresh clicks.
    if (cached && now() - cached.time < (force ? 10000 : ttlMs)) return cached.value;
    pending = loader()
      .then((value) => {
        cached = { value, time: now() };
        return value;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
export async function withRetry<T>(
  read: () => Promise<T>,
  retryable: (error: unknown) => boolean,
  pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (attempt >= 2 || !retryable(error)) throw error;
      await pause(250 * 2 ** attempt + Math.random() * 100);
    }
  }
}
