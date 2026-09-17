import 'server-only';
import { JWT } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { columnLetter, parseClasses, parseCourses, parseSettings } from './adapter';
import { createSnapshotCache, withRetry } from './cache';
import { reportingDate } from './dates';
import type { Cell, DashboardSnapshot } from './model';
import {
  ALLOWED_TABS,
  assertAllowedRange,
  SHEETS_SCOPE,
  SPREADSHEET_ID,
  type AllowedTab,
} from './sheets-policy';

export class SourceError extends Error {
  constructor(
    public code: 'configuration' | 'source_access' | 'temporary' | 'source_structure',
    message: string,
  ) {
    super(message);
  }
}
type SheetProperties = { title: string; gridProperties: { rowCount: number; columnCount: number } };
type SheetResponse = {
  properties: { locale: string; timeZone: string };
  sheets: {
    properties: SheetProperties;
    data?: { startRow?: number; rowData?: { values?: Cell[] }[] }[];
  }[];
};
function status(error: unknown): number {
  return Number(
    (error as { response?: { status?: number }; code?: unknown })?.response?.status ??
      (error as { code?: unknown })?.code ??
      0,
  );
}
async function loadSnapshot(): Promise<DashboardSnapshot> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY)
    throw new SourceError('configuration', 'The Google Sheets connection is not configured.');
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: [SHEETS_SCOPE],
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
  async function read(params: Record<string, unknown>): Promise<SheetResponse> {
    return withRetry(
      async () =>
        (
          await auth.request<SheetResponse>({
            url,
            method: 'GET',
            params,
            timeout: 12000,
            retry: false,
          })
        ).data,
      (error) => [0, 429, 500, 502, 503, 504].includes(status(error)),
    );
  }
  try {
    // Metadata contains tab names/bounds only, never records from disallowed tabs.
    const meta = await read({
      fields:
        'properties(locale,timeZone),sheets(properties(title,gridProperties(rowCount,columnCount)))',
    });
    const permitted = meta.sheets.filter((s) =>
      ALLOWED_TABS.includes(s.properties.title as AllowedTab),
    );
    if (!permitted.some((s) => s.properties.title === 'Sheet5'))
      throw new SourceError('source_structure', 'The source spreadsheet has no Sheet5 tab.');
    const tables: Partial<Record<AllowedTab, Cell[][]>> = {};
    for (const sheet of permitted) {
      const name = sheet.properties.title as AllowedTab,
        { rowCount, columnCount } = sheet.properties.gridProperties;
      if (columnCount > 256 || rowCount * columnCount > 2000000)
        throw new SourceError(
          'source_structure',
          'The source exceeds the supported read budget; contact the maintainer. No partial totals are shown.',
        );
      const rows: Cell[][] = [];
      // Inspect every allocated chunk, including gaps, so later rows cannot be silently omitted.
      for (let start = 1; start <= rowCount; start += 500) {
        const range = `'${name}'!A${start}:${columnLetter(columnCount - 1)}${Math.min(start + 499, rowCount)}`;
        assertAllowedRange(range);
        const data = await read({
          ranges: [range],
          fields:
            'sheets(properties(title),data(startRow,rowData(values(formattedValue,effectiveValue,effectiveFormat(numberFormat)))))',
        });
        for (const block of data.sheets?.[0]?.data ?? [])
          (block.rowData ?? []).forEach((r, i) => {
            rows[(block.startRow ?? start - 1) + i] = r.values ?? [];
          });
      }
      tables[name] = Array.from({ length: rows.length }, (_, i) => rows[i] ?? []);
    }
    const fetchedAt = new Date().toISOString(),
      today = reportingDate(new Date(fetchedAt));
    const courses = parseCourses(tables.Courses ?? []),
      { settings, warnings } = parseSettings(tables.Dashboard_Settings ?? []);
    const classes = parseClasses(
      tables.Sheet5 ?? [],
      today,
      meta.properties.locale,
      courses,
      randomUUID(),
    );
    const updated = classes.flatMap((r) => (r.updatedAt ? [r.updatedAt] : [])).sort();
    return {
      classes,
      fetchedAt,
      reportingDate: today,
      sourceUpdatedAt: updated.at(-1) ?? null,
      sourceUpdatedCoverage: updated.length,
      locale: meta.properties.locale,
      sourceTimeZone: meta.properties.timeZone,
      reportingTimeZone: 'Asia/Manila',
      settings,
      warnings,
    };
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if ([401, 403, 404].includes(status(error)))
      throw new SourceError(
        'source_access',
        'The server cannot access K2K Data Tracker. Ask the owner to check Viewer access for the service account.',
      );
    if (error instanceof Error && /headers?|Course header/.test(error.message))
      throw new SourceError('source_structure', error.message);
    throw new SourceError(
      'temporary',
      'Google Sheets is temporarily unavailable. Please try again shortly.',
    );
  }
}
// 60-second cache allows settings down to a minute; each browser defaults to 5 minutes.
export const getSnapshot = createSnapshotCache(loadSnapshot, 60000);
