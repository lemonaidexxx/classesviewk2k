import { afterEach, expect, it, vi } from 'vitest';
import { cells, syntheticHeaders } from '../src/lib/fixtures';
const mocked = vi.hoisted(() => ({ request: vi.fn(), config: vi.fn() }));
vi.mock('google-auth-library', () => ({
  JWT: class {
    constructor(options: unknown) {
      mocked.config(options);
    }
    request = mocked.request;
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
it('reads only allowlisted tabs with bounded GETs, including classes after a blank chunk', async () => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@example.test');
  vi.stubEnv('GOOGLE_PRIVATE_KEY', 'test-key');
  const gridProperties = { rowCount: 1000, columnCount: 26 };
  mocked.request.mockImplementation(
    async (request: { params: { ranges?: string[] }; method: string }) => {
      if (!request.params.ranges)
        return {
          data: {
            properties: { locale: 'en_US', timeZone: 'Asia/Shanghai' },
            sheets: ['Learners', 'Contacts', 'Sheet5'].map((title) => ({
              properties: { title, gridProperties },
            })),
          },
        };
      const range = request.params.ranges[0];
      if (range === "'Sheet5'!A1:Z500")
        return {
          data: {
            sheets: [
              {
                data: [
                  {
                    startRow: 0,
                    rowData: [
                      { values: cells(['AI COURSE']) },
                      { values: cells(syntheticHeaders) },
                    ],
                  },
                ],
              },
            ],
          },
        };
      if (range === "'Sheet5'!A501:Z1000")
        return {
          data: {
            sheets: [
              {
                data: [
                  {
                    startRow: 500,
                    rowData: [
                      {
                        values: cells([
                          'New course',
                          'Institute',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          '',
                          12,
                        ]),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      throw new Error('Unexpected range');
    },
  );
  const { getSnapshot } = await import('../src/lib/sheets');
  const snapshot = await getSnapshot();
  expect(snapshot.classes).toHaveLength(1);
  expect(snapshot.classes[0].sourceRow).toBe(501);
  expect(snapshot.classes[0].participants.value).toBe(12);
  expect(mocked.request.mock.calls.every(([arg]) => arg.method === 'GET')).toBe(true);
  expect(mocked.request.mock.calls.flatMap(([arg]) => arg.params.ranges ?? [])).toEqual([
    "'Sheet5'!A1:Z500",
    "'Sheet5'!A501:Z1000",
  ]);
  expect(mocked.config).toHaveBeenCalledWith(
    expect.objectContaining({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }),
  );
  expect(JSON.stringify(snapshot)).not.toContain('Learners');
  expect(JSON.stringify(snapshot)).not.toContain('Contacts');
});
it('fails with a configuration error without contacting Google', async () => {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
  vi.stubEnv('GOOGLE_PRIVATE_KEY', '');
  const { getSnapshot } = await import('../src/lib/sheets');
  await expect(getSnapshot()).rejects.toMatchObject({ code: 'configuration' });
  expect(mocked.request).not.toHaveBeenCalled();
});
