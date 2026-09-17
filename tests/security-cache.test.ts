import { describe, expect, it, vi } from 'vitest';
import { createSnapshotCache, withRetry } from '../src/lib/cache';
import { assertAllowedRange, SHEETS_SCOPE, SPREADSHEET_ID } from '../src/lib/sheets-policy';
describe('access and source boundaries', () => {
  it('accepts only bounded permitted ranges', () => {
    expect(SPREADSHEET_ID).toBe('1krs7YPHJvYqoKcegcTq_ri8wHWq44ar_zjdvdvlchq0');
    expect(SHEETS_SCOPE.endsWith('.readonly')).toBe(true);
    for (const r of ["'Sheet5'!A1:Z500", "'Courses'!A1:D20", "'Dashboard_Settings'!A1:B20"])
      expect(() => assertAllowedRange(r)).not.toThrow();
    for (const r of [
      "'Learners'!A1:B20",
      "'Contacts'!A1:C20",
      'Sheet5!A:Z',
      "'Sheet5'!A1:Z20,'Learners'!A1:Z20",
    ])
      expect(() => assertAllowedRange(r)).toThrow();
  });
});
describe('cache and failures', () => {
  it('coalesces concurrent reads and expires normally', async () => {
    let now = 0;
    const loader = vi.fn(async () => ({ total: 17 }));
    const get = createSnapshotCache(loader, 300000, () => now);
    await Promise.all([get(), get()]);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 100;
    await get(true);
    expect(loader).toHaveBeenCalledTimes(1);
    now = 11000;
    await get(true);
    expect(loader).toHaveBeenCalledTimes(2);
    now = 400000;
    await get();
    expect(loader).toHaveBeenCalledTimes(3);
  });
  it('does not cache a failed read as an empty success and restores connectivity', async () => {
    let now = 0;
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ total: 17 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ total: 18 });
    const get = createSnapshotCache<{ total: number }>(loader, 10000, () => now);
    const good = await get();
    now = 20000;
    await expect(get()).rejects.toThrow('offline');
    expect(good.total).toBe(17);
    await expect(get()).resolves.toEqual({ total: 18 });
  });
  it('bounds transient retries and does not retry forbidden access', async () => {
    const read = vi.fn().mockRejectedValue(new Error('outage')),
      pause = vi.fn(async () => {});
    await expect(withRetry(read, () => true, pause)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(3);
    read.mockClear();
    await expect(withRetry(read, () => false, pause)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
