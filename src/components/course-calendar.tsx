'use client';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateFields, dateLabels, type ClassRecord, type DateField } from '@/lib/model';
import { displayDate } from '@/lib/dates';

export default function CourseCalendar({
  records,
  today,
  onSelect,
}: {
  records: ClassRecord[];
  today: string;
  onSelect: (record: ClassRecord) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [field, setField] = useState<DateField>('plannedOpening');
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const { byDay, monthOnly, undated } = useMemo(() => {
    const byDay = new Map<string, ClassRecord[]>();
    const monthOnly: ClassRecord[] = [],
      undated: ClassRecord[] = [];
    for (const record of records) {
      const date = record.dates[field];
      if (date.kind === 'day' && date.value) {
        if (date.value.startsWith(month))
          byDay.set(date.value, [...(byDay.get(date.value) ?? []), record]);
      } else if (date.kind === 'month' && date.value) {
        if (date.value === month) monthOnly.push(record);
      } else undated.push(record);
    }
    return { byDay, monthOnly, undated };
  }, [records, field, month]);
  const shift = (amount: number) =>
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7));
  const label = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
  const event = (record: ClassRecord) => (
    <button
      key={record.key}
      className={`course-event ${record.category === 'AI' ? 'event-ai' : 'event-other'}`}
      onClick={() => onSelect(record)}
    >
      <strong>{record.course || 'Course not recorded'}</strong>
      <span>{record.institution || 'Institute not recorded'}</span>
      <small>
        {record.category} · {displayDate(record.dates[field])}
      </small>
    </button>
  );
  return (
    <section className="course-calendar" aria-label="Course calendar">
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button
            className="icon-button"
            aria-label="Previous month"
            disabled={month === '1900-01'}
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h3 aria-live="polite">{label}</h3>
          <button
            className="icon-button"
            aria-label="Next month"
            disabled={month === '2100-12'}
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button className="button" onClick={() => setMonth(today.slice(0, 7))}>
            This month
          </button>
        </div>
        <div className="calendar-options">
          <label>
            Go to month
            <input
              aria-label="Go to month"
              type="month"
              min="1900-01"
              max="2100-12"
              value={month}
              onChange={(e) => {
                if (/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value))
                  setMonth(e.target.value);
              }}
            />
          </label>
          <label>
            Calendar date
            <select value={field} onChange={(e) => setField(e.target.value as DateField)}>
              {dateFields.map((value) => (
                <option key={value} value={value}>
                  {dateLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="calendar-help">
        Showing {dateLabels[field].toLowerCase()} · All dashboard filters apply. Select a course for
        details. Recorded dates do not confirm completion.
      </p>
      {byDay.size === 0 && monthOnly.length === 0 && (
        <p className="calendar-empty" role="status">
          No courses with this date in {label}.
        </p>
      )}
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="calendar-weekday" aria-hidden="true">
            {day}
          </div>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <div className="calendar-spacer" aria-hidden="true" key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const courses = byDay.get(date) ?? [];
          return (
            <section
              key={date}
              aria-label={date}
              className={`calendar-day ${date === today ? 'is-today' : ''} ${courses.length ? 'has-courses' : ''}`}
            >
              <h4>
                <time dateTime={date} aria-current={date === today ? 'date' : undefined}>
                  <span className="calendar-mobile-month">{label} </span>
                  {i + 1}
                </time>
              </h4>
              {courses.map(event)}
            </section>
          );
        })}
      </div>
      {monthOnly.length > 0 && (
        <section className="calendar-unscheduled" aria-label="Month-only dates">
          <h4>During {label} · exact day not recorded</h4>
          <div className="calendar-event-list">{monthOnly.map(event)}</div>
        </section>
      )}
      {undated.length > 0 && (
        <details className="calendar-unscheduled">
          <summary>
            {undated.length} classes without a valid {dateLabels[field].toLowerCase()} date
          </summary>
          <p>These filtered classes cannot be placed on a calendar day.</p>
          <div className="calendar-event-list">{undated.map(event)}</div>
        </details>
      )}
    </section>
  );
}
