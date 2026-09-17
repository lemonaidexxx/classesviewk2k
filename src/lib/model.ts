export type Cell = {
  formattedValue?: string;
  effectiveValue?: {
    stringValue?: string;
    numberValue?: number;
    boolValue?: boolean;
    errorValue?: unknown;
  };
  effectiveFormat?: { numberFormat?: { type?: string; pattern?: string } };
};
export type DateValue = {
  raw: string;
  cell: string;
  kind: 'day' | 'month' | 'missing' | 'pending' | 'invalid';
  value: string | null;
};
export type CountValue = {
  raw: string;
  cell: string;
  value: number | null;
  kind: 'valid' | 'missing' | 'invalid';
};
export const dateFields = [
  'enrollmentStart',
  'enrollmentEnd',
  'plannedOpening',
  'actualOpening',
  'projectedEnd',
  'actualEnd',
  'graduation',
  'jobFacilitation',
] as const;
export type DateField = (typeof dateFields)[number];
export const dateLabels: Record<DateField, string> = {
  enrollmentStart: 'Enrollment starts',
  enrollmentEnd: 'Enrollment closes',
  plannedOpening: 'Planned opening',
  actualOpening: 'Actual opening',
  projectedEnd: 'Projected end',
  actualEnd: 'Actual end',
  graduation: 'Graduation',
  jobFacilitation: 'Job facilitation',
};
export type InferredStatus =
  | 'Classes ended'
  | 'Ongoing'
  | 'Enrollment open'
  | 'Scheduled'
  | 'Awaiting update'
  | 'Undetermined';
export type Warning = { code: string; message: string; cell?: string };
export type ClassRecord = {
  key: string;
  classId: string | null;
  sourceRow: number;
  courseId: string;
  course: string;
  institution: string;
  region: string;
  province: string;
  municipality: string;
  category: string;
  batch: string;
  recordedStatus: string;
  inferredStatus: InferredStatus;
  status: string;
  archived: boolean;
  participants: CountValue;
  targetParticipants: CountValue;
  notes: string;
  additionalNotes: string;
  dates: Record<DateField, DateValue>;
  updatedAt: string | null;
  warnings: Warning[];
};
export type Course = { id: string; name: string; category: string; active: boolean };
export type DashboardSnapshot = {
  classes: ClassRecord[];
  fetchedAt: string;
  reportingDate: string;
  sourceUpdatedAt: string | null;
  sourceUpdatedCoverage: number;
  locale: string;
  sourceTimeZone: string;
  reportingTimeZone: 'Asia/Manila';
  settings: { refreshSeconds: number; milestoneDays: number };
  warnings: string[];
};
export type Filters = {
  search: string;
  course: string;
  category: string;
  institution: string;
  region: string;
  status: string;
  batch: string;
  from: string;
  to: string;
  includeUndated: boolean;
  archive: 'active' | 'archived' | 'all';
  reviewOnly: boolean;
};
export const defaultFilters: Filters = {
  search: '',
  course: '',
  category: '',
  institution: '',
  region: '',
  status: '',
  batch: '',
  from: '',
  to: '',
  includeUndated: true,
  archive: 'active',
  reviewOnly: false,
};
