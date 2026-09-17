import { addDays, dateBounds } from './dates';
import { dateLabels, type ClassRecord, type DateField, type Filters } from './model';
export function filterClasses(classes: ClassRecord[], f: Filters): ClassRecord[] {
  const search = f.search.trim().toLocaleLowerCase();
  return classes.filter((r) => {
    if (f.archive !== 'all' && r.archived !== (f.archive === 'archived')) return false;
    if (f.reviewOnly && !r.warnings.length) return false;
    if (
      search &&
      ![
        r.course,
        r.institution,
        r.batch,
        r.region,
        r.province,
        r.municipality,
        r.classId ?? '',
        r.notes,
        r.additionalNotes,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search)
    )
      return false;
    for (const field of ['course', 'category', 'institution', 'region', 'status', 'batch'] as const)
      if (f[field] && r[field] !== f[field]) return false;
    if (f.from || f.to) {
      const bounds = dateBounds(r.dates.plannedOpening);
      if (!bounds) return f.includeUndated;
      if ((f.from && bounds[1] < f.from) || (f.to && bounds[0] > f.to)) return false;
    }
    return true;
  });
}
export function summarize(records: ClassRecord[]) {
  const distinct = (field: 'course' | 'institution') =>
    new Set(records.map((r) => r[field].trim().toLowerCase()).filter(Boolean)).size;
  return {
    total: records.length,
    courses: distinct('course'),
    institutes: distinct('institution'),
    participants: records.reduce((n, r) => n + (r.participants.value ?? 0), 0),
    unknownCounts: records.filter((r) => r.participants.value === null).length,
    review: records.filter((r) => r.warnings.length).length,
    statuses: records.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
export type Milestone = {
  record: ClassRecord;
  field: DateField;
  label: string;
  date: ClassRecord['dates'][DateField];
  timing: 'Planned' | 'Recorded date';
};
export function milestones(records: ClassRecord[], today: string, days: number): Milestone[] {
  const end = addDays(today, days),
    result: Milestone[] = [];
  for (const record of records)
    for (const field of [
      'enrollmentStart',
      'enrollmentEnd',
      'plannedOpening',
      'projectedEnd',
      'graduation',
    ] as DateField[]) {
      const date = record.dates[field],
        bounds = dateBounds(date);
      if (bounds && bounds[1] >= today && bounds[0] <= end)
        result.push({
          record,
          field,
          label: dateLabels[field],
          date,
          timing: field === 'graduation' ? 'Recorded date' : 'Planned',
        });
    }
  return result.sort((a, b) => dateBounds(a.date)![0].localeCompare(dateBounds(b.date)![0]));
}
