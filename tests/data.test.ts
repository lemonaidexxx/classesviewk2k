import { describe, expect, it } from 'vitest';
import { parseClasses, parseSettings } from '../src/lib/adapter';
import { addDays, parseCount, parseDate, reportingDate } from '../src/lib/dates';
import { cells, syntheticHeaders, syntheticRows } from '../src/lib/fixtures';
import { defaultFilters, type Cell } from '../src/lib/model';
import { filterClasses, milestones, summarize } from '../src/lib/selectors';
const row = (values: Record<number, string | number | null> = {}) => {
  const result = cells(['New course', 'Institute']);
  for (const [k, v] of Object.entries(values)) result[+k] = cells([v])[0];
  return result;
};
const parse = (...rows: Cell[][]) =>
  parseClasses([cells(['AI COURSE']), cells(syntheticHeaders), ...rows], '2026-09-17');
describe('dates and counts', () => {
  it.each([
    '25 Septembef 2026',
    '20 Augut 2026',
    '28 November 0226',
    '31 February 2026',
    '09/10/2026',
  ])('does not repair %s', (value) =>
    expect(parseDate(cells([value])[0], 'A1').kind).toBe('invalid'),
  );
  it('rejects an implausible native year', () =>
    expect(
      parseDate(
        {
          formattedValue: '28 November 0226',
          effectiveValue: { numberValue: -611083 },
          effectiveFormat: { numberFormat: { type: 'DATE', pattern: 'd mmmm yyyy' } },
        },
        'K16',
      ).kind,
    ).toBe('invalid'));
  it('retains displayed month precision on a native date', () =>
    expect(
      parseDate(
        {
          formattedValue: 'October 2026',
          effectiveValue: { numberValue: 46296 },
          effectiveFormat: { numberFormat: { type: 'DATE', pattern: 'mmmm yyyy' } },
        },
        'L18',
      ),
    ).toMatchObject({ kind: 'month', value: '2026-10', raw: 'October 2026' }));
  it('handles native and strict text dates without timezone shifts', () => {
    expect(
      parseDate(
        {
          formattedValue: '3 August 2026',
          effectiveValue: { numberValue: 46237 },
          effectiveFormat: { numberFormat: { type: 'DATE', pattern: 'd mmmm yyyy' } },
        },
        'H3',
      ).value,
    ).toBe('2026-08-03');
    expect(parseDate(cells(['August 7, 2026'])[0], 'A1').value).toBe('2026-08-07');
    expect(parseDate(cells(['29 February 2024'])[0], 'A1').value).toBe('2024-02-29');
    expect(reportingDate(new Date('2026-09-16T18:00:00Z'))).toBe('2026-09-17');
  });
  it('separates blank, pending, and invalid dates', () => {
    expect(parseDate(undefined, 'A1').kind).toBe('missing');
    for (const value of ['TBA', 'TO BE DETERMINED'])
      expect(parseDate(cells([value])[0], 'A1').kind).toBe('pending');
  });
  it('counts unknown and explicit zero differently', () => {
    expect(parseCount(undefined, 'N3').value).toBeNull();
    expect(parseCount(cells([0])[0], 'N3')).toMatchObject({ value: 0, kind: 'valid' });
    for (const v of [-1, 1.5, 'twenty', '1,2', '1e3'])
      expect(parseCount(cells([v])[0], 'N3').kind).toBe('invalid');
    expect(parseCount(cells(['1,200'])[0], 'N3').value).toBe(1200);
  });
});
describe('adapter and selectors', () => {
  it('parses synthetic baseline shape with separate cohorts and correct totals', () => {
    const records = parseClasses(syntheticRows(), '2026-09-17');
    expect(summarize(records)).toMatchObject({
      total: 17,
      courses: 8,
      participants: 381,
      unknownCounts: 1,
    });
    expect(records.filter((r) => r.category === 'AI')).toHaveLength(8);
    expect(records.filter((r) => r.category === 'Non-AI')).toHaveLength(9);
  });
  it('retains incomplete classes, ignores only separators, and preserves P', () => {
    const records = parse(
      row({ 15: 'Extra note' }),
      cells(['   ']),
      cells(['NON AI COURSE']),
      row({ 0: '', 1: 'Only institute' }),
    );
    expect(records).toHaveLength(2);
    expect(records[0].additionalNotes).toBe('Extra note');
    expect(records[1].category).toBe('Non-AI');
    expect(records[1].warnings.some((w) => w.code === 'missing_field')).toBe(true);
  });
  it('supports new courses and rows after gaps without fixed boundaries', () => {
    expect(
      parse(...Array.from({ length: 60 }, () => []), row({ 0: 'Brand new course' })).at(-1)?.course,
    ).toBe('Brand new course');
  });
  it('keeps IDs persistent across reorder, flags duplicates without merging', () => {
    const a = row({ 16: 'id-a' }),
      b = row({ 16: 'id-b' });
    expect(parse(b, a).map((r) => r.classId)).toEqual(['id-b', 'id-a']);
    const duplicate = parse(a, a);
    expect(duplicate).toHaveLength(2);
    expect(duplicate.every((r) => r.warnings.some((w) => w.code === 'duplicate_id'))).toBe(true);
    expect(duplicate[0].key).not.toBe(duplicate[1].key);
  });
  it('honors category precedence and keeps inactive catalog classes', () => {
    const r = parseClasses(
      [cells(['AI COURSE']), cells(syntheticHeaders), row({ 17: 'c1', 18: 'Non-AI' })],
      '2026-09-17',
      'en_US',
      [{ id: 'c1', name: 'New course', category: 'AI', active: false }],
    );
    expect(r[0].category).toBe('Non-AI');
    expect(r[0].warnings.some((w) => w.code === 'category_conflict')).toBe(true);
  });
  it('does not infer occurrence from future actual dates or notes', () => {
    const r = parse(
      row({ 7: '3 November 2026', 8: '3 November 2026', 10: '4 December 2026', 14: 'Graduated' }),
    )[0];
    expect(r.inferredStatus).toBe('Scheduled');
    expect(r.warnings.filter((w) => w.code === 'future_actual')).toHaveLength(2);
  });
  it('infers statuses in conservative order and flags contradictory evidence', () => {
    expect(parse(row({ 8: '1 September 2026', 10: '15 September 2026' }))[0].inferredStatus).toBe(
      'Classes ended',
    );
    expect(parse(row({ 8: '1 September 2026' }))[0].inferredStatus).toBe('Ongoing');
    expect(parse(row({ 5: '1 September 2026', 6: '20 September 2026' }))[0].inferredStatus).toBe(
      'Enrollment open',
    );
    expect(parse(row())[0].inferredStatus).toBe('Awaiting update');
    expect(parse(row({ 8: 'September 2026' }))[0].inferredStatus).toBe('Undetermined');
    expect(parse(row({ 8: '15 September 2026', 10: '1 September 2026' }))[0].inferredStatus).toBe(
      'Undetermined',
    );
    expect(parse(row({ 8: '1 September 2026', 10: 'bad date' }))[0].inferredStatus).toBe(
      'Undetermined',
    );
    expect(parse(row({ 8: '1 September 2026', 20: 'Cancelled' }))[0]).toMatchObject({
      status: 'Cancelled',
      inferredStatus: 'Ongoing',
    });
  });
  it('applies filters consistently, including overlapping months, archives, and undated rows', () => {
    const records = parse(
      row({ 7: 'October 2026', 13: 20 }),
      row({ 13: 10 }),
      row({ 7: '1 September 2026', 13: 5 }),
      row({ 22: 'TRUE', 13: 99 }),
    );
    const f = { ...defaultFilters, from: '2026-10-15', to: '2026-10-20', includeUndated: false };
    const subset = filterClasses(records, f);
    expect(subset).toHaveLength(1);
    expect(summarize(subset).participants).toBe(20);
    expect(milestones(subset, '2026-10-15', 10)).toHaveLength(1);
    expect(filterClasses(records, { ...f, includeUndated: true })).toHaveLength(2);
    expect(filterClasses(records, { ...defaultFilters, archive: 'archived' })).toHaveLength(1);
    expect(filterClasses(records, { ...defaultFilters, archive: 'all' })).toHaveLength(4);
  });
  it('uses valid settings only', () =>
    expect(
      parseSettings([
        cells(['Setting', 'Value']),
        cells(['refreshSeconds', 1]),
        cells(['milestoneDays', 14]),
      ]),
    ).toMatchObject({
      settings: { refreshSeconds: 300, milestoneDays: 14 },
      warnings: [expect.any(String)],
    }));
  it('adds days across year boundaries', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
});
