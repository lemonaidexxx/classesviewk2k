import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { syntheticHeaders } from '../src/lib/fixtures';
const script = readFileSync('scripts/setup-sheet.gs', 'utf8');
function mockSheet(initial: unknown[][]) {
  const data = initial.map((r) => [...r]);
  let maxColumns = 26;
  const range = (row: number, col: number, height = 1, width = 1) => ({
    getDisplayValues: () =>
      Array.from({ length: height }, (_, i) =>
        Array.from({ length: width }, (_, j) => String(data[row - 1 + i]?.[col - 1 + j] ?? '')),
      ),
    getFormulas: () =>
      Array.from({ length: height }, () => Array.from({ length: width }, () => '')),
    getFormula: () => '',
    getValue: () => data[row - 1]?.[col - 1] ?? '',
    setValue: (value: unknown) => {
      data[row - 1] ??= [];
      data[row - 1][col - 1] = value;
    },
    setValues: (values: unknown[][]) => {
      values.forEach((r, i) =>
        r.forEach((v, j) => {
          data[row - 1 + i] ??= [];
          data[row - 1 + i][col - 1 + j] = v;
        }),
      );
    },
    setDataValidation: () => {},
  });
  return {
    data,
    getRange: range,
    getLastColumn: () => Math.max(0, ...data.map((r) => r.length)),
    getLastRow: () => data.length,
    getMaxRows: () => 1000,
    getMaxColumns: () => maxColumns,
    insertColumnsAfter: (_: number, n: number) => {
      maxColumns += n;
    },
    getDataRange: () => range(1, 1, data.length, Math.max(1, ...data.map((r) => r.length))),
    setFrozenRows: () => {},
    appendRow: (r: unknown[]) => data.push(r),
  };
}
it('owner setup is repeatable, preserves P and existing IDs, and does not ID dividers', () => {
  const sheet = mockSheet([
    ['AI COURSE'],
    syntheticHeaders.slice(0, 16),
    ['Course A', 'Institute', '', '', '', '', '', '', '', '', '', '', '', 0, '', 'Keep P'],
    [' '],
    ['NON AI COURSE'],
    ['Course B', 'Institute'],
  ]);
  const tabs: Record<string, ReturnType<typeof mockSheet>> = { Sheet5: sheet };
  let serial = 0;
  const validation = {
    requireValueInRange: () => validation,
    requireValueInList: () => validation,
    setAllowInvalid: () => validation,
    setHelpText: () => validation,
    build: () => ({}),
  };
  const book = {
    getSheetByName: (n: string) => tabs[n],
    insertSheet: (n: string) => (tabs[n] = mockSheet([])),
  };
  const context = vm.createContext({
    SpreadsheetApp: { openById: () => book, newDataValidation: () => validation },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { getUuid: () => `uuid-${++serial}` },
    console: { log: () => {} },
  });
  vm.runInContext(script, context);
  const first = vm.runInContext('setupK2KTracker()', context);
  expect(first.assigned).toBe(2);
  expect(sheet.data[2][15]).toBe('Keep P');
  const id = sheet.data[2][16];
  const second = vm.runInContext('setupK2KTracker()', context);
  expect(second.assigned).toBe(0);
  expect(sheet.data[2][16]).toBe(id);
  expect(sheet.data[4][16]).toBeUndefined();
  expect(Object.keys(tabs)).toEqual(['Sheet5', 'Courses', 'Dashboard_Settings']);
  expect(tabs.Dashboard_Settings.data).toHaveLength(3);
  sheet.data[5][16] = id;
  expect(vm.runInContext('setupK2KTracker()', context).duplicateRows).toEqual([6]);
  expect(sheet.data[5][16]).toBe(id);
});

it.each(['Extra Q note', ''])(
  'supports row-one headers and reserves Q even when empty (%s)',
  (extra) => {
    const headers = ['Course', 'Category', ...syntheticHeaders.slice(1, 15)];
    const row = [
      'Synthetic course',
      'AI',
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
      0,
      'Keep P',
    ];
    if (extra) row.push(extra);
    const sheet = mockSheet([headers, row]);
    const tabs: Record<string, ReturnType<typeof mockSheet>> = { Sheet5: sheet };
    const validation = {
      requireValueInRange: () => validation,
      requireValueInList: () => validation,
      setAllowInvalid: () => validation,
      setHelpText: () => validation,
      build: () => ({}),
    };
    let serial = 0;
    const context = vm.createContext({
      SpreadsheetApp: {
        openById: () => ({
          getSheetByName: (n: string) => tabs[n],
          insertSheet: (n: string) => (tabs[n] = mockSheet([])),
        }),
        newDataValidation: () => validation,
      },
      LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
      Utilities: { getUuid: () => `new-id-${++serial}` },
      console: { log: () => {} },
    });
    vm.runInContext(script, context);
    expect(vm.runInContext('setupK2KTracker()', context).assigned).toBe(1);
    expect(sheet.data[0][17]).toBe('Class ID');
    expect(sheet.data[0].filter((v) => v === 'Category')).toHaveLength(1);
    expect(sheet.data[1][15]).toBe('Keep P');
    expect(sheet.data[1][16] ?? '').toBe(extra);
    expect(sheet.data[1][17]).toBe('new-id-1');
    expect(vm.runInContext('setupK2KTracker()', context).assigned).toBe(0);
    sheet.data.push([...row]);
    expect(vm.runInContext('setupK2KTracker()', context).assigned).toBe(1);
    expect(sheet.data[2][17]).toBe('new-id-2');
  },
);
