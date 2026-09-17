import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseClasses } from '../src/lib/adapter';
import type { Cell } from '../src/lib/model';
import { summarize } from '../src/lib/selectors';
// Optional local-only verification. No live rows or workbook exports belong in Git.
const path = 'private/source-snapshot.json';
it.skipIf(!existsSync(path))('verifies the provided private baseline snapshot', () => {
  const source = JSON.parse(readFileSync(path, 'utf8'));
  const rows: Cell[][] = source.sheets[0].data[0].rowData.map(
    (r: { values?: Cell[] }) => r.values ?? [],
  );
  const records = parseClasses(rows, '2026-09-17', source.properties.locale);
  expect(summarize(records)).toMatchObject({
    total: 17,
    courses: 8,
    participants: 381,
    unknownCounts: 1,
  });
  expect(records.filter((r) => r.category === 'AI')).toHaveLength(8);
  expect(records.filter((r) => r.category === 'Non-AI')).toHaveLength(9);
  expect(records.filter((r) => r.participants.kind === 'valid')).toHaveLength(16);
});
