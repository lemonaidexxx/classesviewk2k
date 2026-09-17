// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CourseCalendar from '../src/components/course-calendar';
import { previewSnapshot } from '../src/lib/fixtures';
afterEach(cleanup);
it('keeps exact, month-only, invalid and duplicate classes distinct, with leap-year navigation', () => {
  const records = previewSnapshot()
    .classes.slice(0, 4)
    .map((record, i) => ({
      ...record,
      course: `Calendar course ${i}`,
      dates: {
        ...record.dates,
        plannedOpening: {
          raw: i < 2 ? '29 Feb 2028' : i === 2 ? 'Feb 2028' : 'bad date',
          cell: `H${i + 3}`,
          kind: i < 2 ? ('day' as const) : i === 2 ? ('month' as const) : ('invalid' as const),
          value: i < 2 ? '2028-02-29' : i === 2 ? '2028-02' : null,
        },
      },
    }));
  const select = vi.fn();
  render(<CourseCalendar records={records} today="2028-02-01" onSelect={select} />);
  const leapDay = screen.getByRole('region', { name: '2028-02-29' });
  expect(within(leapDay).getAllByRole('button')).toHaveLength(2);
  expect(within(leapDay).queryByText('Calendar course 2')).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Month-only dates' })).getByText('Calendar course 2'),
  ).toBeInTheDocument();
  fireEvent.click(within(leapDay).getAllByRole('button')[0]);
  expect(select).toHaveBeenCalledWith(records[0]);
  expect(screen.getByText('1 classes without a valid planned opening date')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(screen.getByText('No courses with this date in March 2028.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'This month' }));
  expect(screen.getByRole('region', { name: '2028-02-29' })).toBeInTheDocument();
});
