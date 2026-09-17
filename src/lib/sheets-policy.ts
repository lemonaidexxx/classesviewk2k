export const SPREADSHEET_ID = '1krs7YPHJvYqoKcegcTq_ri8wHWq44ar_zjdvdvlchq0';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export const ALLOWED_TABS = ['Sheet5', 'Courses', 'Dashboard_Settings'] as const;
export type AllowedTab = (typeof ALLOWED_TABS)[number];
export function assertAllowedRange(range: string): void {
  if (!/^'(Sheet5|Courses|Dashboard_Settings)'![A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/.test(range))
    throw new Error('Range is not allowlisted.');
}
