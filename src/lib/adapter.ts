import { dateBounds, parseCount, parseDate, text } from './dates';
import {
  dateFields,
  dateLabels,
  type Cell,
  type ClassRecord,
  type Course,
  type DateField,
  type InferredStatus,
  type Warning,
} from './model';

const aliases: Record<string, string[]> = {
  course: ['course', 'course name'],
  institution: ['training institute', 'institution'],
  region: ['regions', 'region'],
  province: ['province'],
  municipality: ['municipality/ city', 'municipality/city', 'municipality / city'],
  enrollmentStart: ['enrollment start date'],
  enrollmentEnd: ['enrollment end date'],
  plannedOpening: ['class opening', 'planned opening'],
  actualOpening: ['actual class opening'],
  projectedEnd: ['projected end of classes'],
  actualEnd: ['actual end of classes'],
  graduation: ['graduation'],
  jobFacilitation: ['job facilitarion', 'job facilitation'],
  participants: ['number of participants'],
  notes: ['notes'],
  additionalNotes: ['additional notes'],
  classId: ['class id'],
  courseId: ['course id'],
  category: ['category'],
  batch: ['batch/cohort', 'batch / cohort', 'batch', 'cohort'],
  recordedStatus: ['status'],
  targetParticipants: ['target participants'],
  archived: ['archived'],
  updatedAt: ['updated at'],
};
const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
export function categoryName(value: string): string {
  const s = value.trim();
  if (/^AI(?: COURSE)?$/i.test(s)) return 'AI';
  if (/^NON[ -]?AI(?: COURSE)?$/i.test(s)) return 'Non-AI';
  return s;
}
export function sectionLabel(row: Cell[]): string | null {
  const value = text(row[0]).trim();
  return /^(AI COURSE|NON[ -]?AI COURSE)$/i.test(value) &&
    row.slice(1).every((c) => !text(c).trim())
    ? categoryName(value)
    : null;
}
export function columnLetter(n: number): string {
  let s = '';
  for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export function headerMap(row: Cell[]): Record<string, number> {
  const headers = row.map((c) => clean(text(c))),
    result: Record<string, number> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const matches = headers.flatMap((h, i) => (names.includes(h) ? [i] : []));
    if (matches.length > 1) throw new Error(`Duplicate header for ${field}; review Sheet5 row 2.`);
    if (matches.length) result[field] = matches[0];
  }
  if (result.course === undefined) throw new Error('Sheet5 row 2 must contain the Course header.');
  // The legacy unlabeled P column is an intentional, documented exception.
  if (!headers[15]) result.additionalNotes = 15;
  return result;
}
export function inferStatus(record: ClassRecord, today: string): InferredStatus {
  const d = record.dates;
  const past = (field: DateField) => {
    const b = dateBounds(d[field]);
    return !!b && b[1] <= today;
  };
  const future = (field: DateField) => {
    const b = dateBounds(d[field]);
    return !!b && b[0] > today;
  };
  if (record.warnings.some((w) => w.code === 'actual_sequence')) return 'Undetermined';
  if (past('actualEnd')) return 'Classes ended';
  if (d.actualEnd.kind === 'invalid') return 'Undetermined';
  if (past('actualOpening')) return 'Ongoing';
  if (d.actualOpening.kind === 'invalid') return 'Undetermined';
  if (
    ['actualOpening', 'actualEnd'].some(
      (f) =>
        record.dates[f as DateField].kind === 'month' &&
        !past(f as DateField) &&
        !future(f as DateField),
    )
  )
    return 'Undetermined';
  const start = dateBounds(d.enrollmentStart),
    end = dateBounds(d.enrollmentEnd);
  if (start && end && start[1] <= end[0] && start[1] <= today && end[0] >= today)
    return 'Enrollment open';
  if (future('plannedOpening') || future('enrollmentStart')) return 'Scheduled';
  return 'Awaiting update';
}
export function parseClasses(
  rows: Cell[][],
  today: string,
  locale = 'en_US',
  courses: Course[] = [],
  snapshotId = 'snapshot',
): ClassRecord[] {
  const headers = headerMap(rows[1] ?? []);
  let section = sectionLabel(rows[0] ?? []) ?? '';
  const records: ClassRecord[] = [];
  for (let index = 2; index < rows.length; index++) {
    const row = rows[index] ?? [],
      label = sectionLabel(row);
    if (label) {
      section = label;
      continue;
    }
    if (row.every((c) => !text(c).trim() && !c?.effectiveValue?.errorValue)) continue;
    const sourceRow = index + 1;
    const ref = (field: string) =>
      headers[field] === undefined
        ? `Sheet5!${sourceRow}:${sourceRow}`
        : `Sheet5!${columnLetter(headers[field])}${sourceRow}`;
    const cell = (field: string) => row[headers[field]];
    const get = (field: string) => text(cell(field)).trim();
    const warnings: Warning[] = [];
    const warn = (code: string, message: string, field?: string) =>
      warnings.push({ code, message, ...(field ? { cell: ref(field) } : {}) });
    const explicit = categoryName(get('category')),
      courseId = get('courseId');
    const linked = courseId ? courses.filter((c) => c.id === courseId) : [];
    const catalogCategory = linked.length === 1 ? categoryName(linked[0].category) : '';
    if (courseId && linked.length !== 1)
      warn(
        'course_link',
        linked.length
          ? 'Course ID matches multiple catalog entries.'
          : 'Course ID not found in the catalog.',
        'courseId',
      );
    if (linked.length === 1 && get('course') && clean(linked[0].name) !== clean(get('course')))
      warn('course_name', 'Course name differs from its linked catalog entry.', 'courseId');
    if (new Set([explicit, catalogCategory, section].filter(Boolean).map(clean)).size > 1)
      warn('category_conflict', 'Row, catalog, and section categories disagree.', 'category');
    const dates = Object.fromEntries(
      dateFields.map((f) => [f, parseDate(cell(f), ref(f), locale)]),
    ) as ClassRecord['dates'];
    for (const f of dateFields) {
      if (dates[f].kind === 'invalid')
        warn('invalid_date', `${dateLabels[f]} has an invalid or ambiguous date.`, f);
      if (dates[f].kind === 'month')
        warn(
          'month_precision',
          `${dateLabels[f]} records a month only; the exact day is unknown.`,
          f,
        );
    }
    if (dates.plannedOpening.kind === 'missing' || dates.plannedOpening.kind === 'pending')
      warn(
        'missing_schedule',
        'Planned class opening is not yet recorded as a date.',
        'plannedOpening',
      );
    for (const f of ['actualOpening', 'actualEnd'] as const) {
      const b = dateBounds(dates[f]);
      if (b && b[0] > today)
        warn('future_actual', `${dateLabels[f]} is in the future; occurrence is not confirmed.`, f);
    }
    for (const [a, b] of [
      ['enrollmentStart', 'enrollmentEnd'],
      ['plannedOpening', 'projectedEnd'],
      ['actualOpening', 'actualEnd'],
      ['actualEnd', 'graduation'],
    ] as [DateField, DateField][]) {
      const start = dateBounds(dates[a]),
        end = dateBounds(dates[b]);
      if (start && end && start[0] > end[1])
        warn(
          a === 'actualOpening' ? 'actual_sequence' : 'date_sequence',
          `${dateLabels[b]} precedes ${dateLabels[a].toLowerCase()}.`,
          b,
        );
    }
    for (const [planned, actual] of [
      ['plannedOpening', 'actualOpening'],
      ['projectedEnd', 'actualEnd'],
    ] as [DateField, DateField][]) {
      const p = dateBounds(dates[planned]),
        a = dateBounds(dates[actual]);
      if (p && p[1] < today && (!a || a[1] > today))
        warn(
          'unconfirmed',
          `${dateLabels[actual]} not recorded as a confirmed past event.`,
          actual,
        );
    }
    const participants = parseCount(cell('participants'), ref('participants'));
    if (participants.kind !== 'valid')
      warn(
        'participants',
        participants.kind === 'missing'
          ? 'Participant count not recorded.'
          : 'Participant count must be a nonnegative whole number.',
        'participants',
      );
    const targetParticipants = parseCount(cell('targetParticipants'), ref('targetParticipants'));
    if (targetParticipants.kind === 'invalid')
      warn(
        'target_participants',
        'Target participant count must be a nonnegative whole number.',
        'targetParticipants',
      );
    for (const f of ['course', 'institution'] as const)
      if (!get(f))
        warn(
          'missing_field',
          `${f === 'course' ? 'Course' : 'Training institute'} not recorded.`,
          f,
        );
    if (!get('classId'))
      warn(
        'missing_id',
        'Persistent Class ID not assigned. Run the owner setup helper.',
        'classId',
      );
    const archiveValue = get('archived');
    if (archiveValue && !/^(true|false|yes|no|1|0)$/i.test(archiveValue))
      warn(
        'invalid_archive',
        'Archived value is unrecognized; this class remains visible.',
        'archived',
      );
    const updated = parseDate(cell('updatedAt'), ref('updatedAt'), locale);
    if (get('updatedAt') && updated.kind !== 'day')
      warn(
        'updated_at',
        'Updated At must contain a valid full date; no edit time is inferred.',
        'updatedAt',
      );
    const record: ClassRecord = {
      key: `${snapshotId}:${sourceRow}`,
      classId: get('classId') || null,
      sourceRow,
      courseId,
      course: get('course') || (linked.length === 1 ? linked[0].name : ''),
      institution: get('institution'),
      region: get('region'),
      province: get('province'),
      municipality: get('municipality'),
      category: explicit || catalogCategory || section || 'Uncategorized',
      batch: get('batch'),
      recordedStatus: get('recordedStatus'),
      inferredStatus: 'Awaiting update',
      status: '',
      archived: /^(true|yes|1)$/i.test(archiveValue),
      participants,
      targetParticipants,
      notes: text(cell('notes')),
      additionalNotes: text(cell('additionalNotes')),
      dates,
      updatedAt: updated.kind === 'day' ? updated.value : null,
      warnings,
    };
    record.inferredStatus = inferStatus(record, today);
    record.status = record.recordedStatus || record.inferredStatus;
    if (record.recordedStatus && clean(record.recordedStatus) !== clean(record.inferredStatus))
      warn(
        'status_evidence',
        `Recorded status “${record.recordedStatus}” differs from inferred status “${record.inferredStatus}”; review the evidence.`,
        'recordedStatus',
      );
    records.push(record);
  }
  const ids = new Map<string, number>();
  records.forEach((r) => {
    if (r.classId) ids.set(r.classId, (ids.get(r.classId) ?? 0) + 1);
  });
  records.forEach((r) => {
    if (r.classId && ids.get(r.classId)! > 1)
      r.warnings.push({
        code: 'duplicate_id',
        message: 'Duplicate Class ID; both class rows have been retained.',
        cell: `Sheet5!${columnLetter(headers.classId)}${r.sourceRow}`,
      });
  });
  return records;
}
export function parseCourses(rows: Cell[][]): Course[] {
  if (!rows.length) return [];
  const h = rows[0].map((c) => clean(text(c)));
  if (!['course id', 'course name', 'category', 'active'].every((v) => h.includes(v)))
    throw new Error('Courses headers must be Course ID, Course Name, Category, Active.');
  return rows
    .slice(1)
    .filter((r) => r.some((c) => text(c).trim()))
    .map((row) => {
      const get = (name: string) => text(row[h.indexOf(name)]).trim();
      return {
        id: get('course id'),
        name: get('course name'),
        category: get('category'),
        active: !/^(false|no|0)$/i.test(get('active')),
      };
    });
}
export function parseSettings(rows: Cell[][]): {
  settings: { refreshSeconds: number; milestoneDays: number };
  warnings: string[];
} {
  const settings = { refreshSeconds: 300, milestoneDays: 30 },
    warnings: string[] = [];
  for (const row of rows.slice(1)) {
    const key = text(row[0]).trim(),
      value = Number(text(row[1]));
    if (key === 'refreshSeconds' || key === 'milestoneDays') {
      const [min, max] = key === 'refreshSeconds' ? [60, 3600] : [1, 365];
      if (Number.isInteger(value) && value >= min && value <= max) settings[key] = value;
      else warnings.push(`Invalid ${key} setting; using the default.`);
    }
  }
  return { settings, warnings };
}
