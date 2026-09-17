import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSnapshot: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSnapshot: mocks.getSnapshot,
  SourceError: class extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
import { GET } from '../src/app/api/dashboard/route';
describe('public read-only data endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it.each(['?spreadsheetId=other', '?range=Learners', '?refresh=anything'])(
    'rejects client-controlled sources %s',
    async (query) => {
      expect((await GET(new Request(`http://localhost/api/dashboard${query}`))).status).toBe(400);
      expect(mocks.getSnapshot).not.toHaveBeenCalled();
    },
  );
  it('allows reads without sign-in and prevents intermediary storage', async () => {
    mocks.getSnapshot.mockResolvedValue({ classes: [] });
    const response = await GET(new Request('http://localhost/api/dashboard?refresh=1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.getSnapshot).toHaveBeenCalledWith(true);
  });
  it('does not turn an upstream failure into zero classes', async () => {
    mocks.getSnapshot.mockRejectedValue(new Error('secret error detail'));
    const response = await GET(new Request('http://localhost/api/dashboard'));
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.classes).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('secret');
  });
});
