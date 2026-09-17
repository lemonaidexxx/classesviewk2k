// Synthetic development data only. Never substitute this for a failed live read.
import { parseClasses } from './adapter';
import type { Cell, DashboardSnapshot } from './model';
export const syntheticHeaders = [
  'Course',
  'Training Institute ',
  'Regions',
  'Province',
  'Municipality/ City',
  'Enrollment Start Date',
  'Enrollment End Date',
  'Class Opening',
  'Actual Class Opening',
  'Projected End of Classes',
  'Actual End of Classes',
  'Graduation',
  'Job Facilitarion',
  'Number of Participants',
  'Notes',
  '',
  'Class ID',
  'Course ID',
  'Category',
  'Batch/Cohort',
  'Status',
  'Target Participants',
  'Archived',
  'Updated At',
];
export function cells(values: (string | number | boolean | null)[]): Cell[] {
  return values.map((v) =>
    v === null
      ? {}
      : {
          formattedValue: String(v),
          effectiveValue:
            typeof v === 'number'
              ? { numberValue: v }
              : typeof v === 'boolean'
                ? { boolValue: v }
                : { stringValue: v },
        },
  );
}
export function syntheticRows(): Cell[][] {
  const names = [
    'Applied AI Foundations',
    'Digital Customer Experience',
    'Sustainable Food Production',
    'Hospitality Operations',
    'Data Analytics Essentials',
    'Creative Enterprise',
    'Community Health Support',
    'Business Process Services',
  ];
  const institutes = [
    'Northbridge Learning Institute',
    'Greenfield Technical College',
    'Meridian Skills Academy',
    'Harbor Training Center',
    'Summit Development Institute',
    'Riverside College',
  ];
  const result = [cells(['AI COURSE']), cells(syntheticHeaders)];
  for (let i = 0; i < 17; i++) {
    if (i === 8) result.push(cells(['   ']), cells(['NON AI COURSE']));
    result.push(
      cells([
        i < 8 ? names[0] : names[1 + ((i - 8) % 7)],
        institutes[i % 6],
        ['Region I', 'Region III', 'Region IV-A'][i % 3],
        ['Sample Province A', 'Sample Province B'][i % 2],
        ['North City', 'East City', 'River City'][i % 3],
        '1 September 2026',
        '20 September 2026',
        i % 3 === 0 ? '22 September 2026' : '1 September 2026',
        i % 3 === 0 ? '' : '2 September 2026',
        '30 September 2026',
        i % 4 === 0 ? '15 September 2026' : '',
        i % 5 === 0 ? 'October 2026' : '',
        '',
        i === 4 ? null : i === 0 ? 18 : i === 1 ? 16 : i === 12 ? 22 : 25,
        i === 4 ? 'Participant count awaiting confirmation.' : '',
        i === 2 ? 'Confirm the final session date with the institute.' : '',
        `DEMO-${String(i + 1).padStart(3, '0')}`,
        '',
        '',
        `Batch ${(i % 3) + 1}`,
        '',
        25,
        false,
        '16 September 2026',
      ]),
    );
  }
  return result;
}
export function previewSnapshot(): DashboardSnapshot {
  return {
    classes: parseClasses(syntheticRows(), '2026-09-17', 'en_US', [], 'synthetic'),
    fetchedAt: '2026-09-17T02:30:00.000Z',
    reportingDate: '2026-09-17',
    sourceUpdatedAt: '2026-09-16',
    sourceUpdatedCoverage: 17,
    locale: 'en_US',
    sourceTimeZone: 'Asia/Shanghai',
    reportingTimeZone: 'Asia/Manila',
    settings: { refreshSeconds: 300, milestoneDays: 30 },
    warnings: [],
  };
}
