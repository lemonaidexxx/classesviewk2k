'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ListFilter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import { dateBounds, displayDate } from '@/lib/dates';
import {
  defaultFilters,
  type ClassRecord,
  type DashboardSnapshot,
  type Filters,
} from '@/lib/model';
import { filterClasses, milestones, summarize } from '@/lib/selectors';
import DetailDrawer from './detail-drawer';
import Footer from './footer';
import CourseCalendar from './course-calendar';

type SortKey =
  | 'course'
  | 'institution'
  | 'category'
  | 'region'
  | 'province'
  | 'municipality'
  | 'batch'
  | 'participants'
  | 'plannedOpening'
  | 'actualOpening'
  | 'projectedEnd'
  | 'actualEnd'
  | 'status';
const columns: { key: SortKey; title: string }[] = [
  { key: 'course', title: 'Course / class' },
  { key: 'institution', title: 'Training institute' },
  { key: 'category', title: 'Category' },
  { key: 'region', title: 'Region' },
  { key: 'province', title: 'Province' },
  { key: 'municipality', title: 'Municipality / city' },
  { key: 'batch', title: 'Batch' },
  { key: 'participants', title: 'Participants' },
  { key: 'plannedOpening', title: 'Planned opening' },
  { key: 'actualOpening', title: 'Actual opening' },
  { key: 'projectedEnd', title: 'Projected end' },
  { key: 'actualEnd', title: 'Actual end' },
  { key: 'status', title: 'Status' },
];
const number = (n: number) => n.toLocaleString('en-US');
function time(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      }).format(new Date(value))
    : 'Not yet';
}
function Status({ record }: { record: ClassRecord }) {
  return (
    <span className={`status status-${record.status.toLowerCase().replaceAll(' ', '-')}`}>
      <i />
      {record.status}
      <small>{record.recordedStatus ? 'Recorded' : 'Inferred'}</small>
    </span>
  );
}
function sortValue(r: ClassRecord, key: SortKey): string | number | null {
  if (key === 'participants') return r.participants.value;
  if (key in r.dates) return dateBounds(r.dates[key as keyof typeof r.dates])?.[0] ?? null;
  return String(r[key as keyof ClassRecord]);
}

export default function Dashboard({ previewSnapshot }: { previewSnapshot?: DashboardSnapshot }) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(previewSnapshot ?? null);
  const [loading, setLoading] = useState(!previewSnapshot),
    [error, setError] = useState(''),
    [errorCode, setErrorCode] = useState('');
  const [attempt, setAttempt] = useState<string | null>(null),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'course', asc: true }),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<ClassRecord | null>(null);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [visibleColumns, setVisibleColumns] = useState<SortKey[]>(columns.map((c) => c.key));
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem('k2k-columns-v1') ?? 'null');
        if (Array.isArray(saved))
          setVisibleColumns(
            columns.filter((c) => c.key === 'course' || saved.includes(c.key)).map((c) => c.key),
          );
      } catch {
        /* Storage may be unavailable; show all columns. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const updateColumns = (next: SortKey[]) => {
    setVisibleColumns(next);
    try {
      localStorage.setItem('k2k-columns-v1', JSON.stringify(next));
    } catch {
      /* Keep in-memory preferences. */
    }
  };
  const inflight = useRef(false),
    abort = useRef<AbortController | null>(null);
  const refresh = useCallback(
    async (manual = false) => {
      if (inflight.current || previewSnapshot) return;
      inflight.current = true;
      setLoading(true);
      setAttempt(new Date().toISOString());
      const controller = new AbortController();
      abort.current = controller;
      const timeout = setTimeout(() => controller.abort(), 55000);
      try {
        const response = await fetch(`/api/dashboard${manual ? '?refresh=1' : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          setErrorCode(data.code ?? 'temporary');
          throw new Error(data.error ?? 'Unable to refresh data.');
        }
        setSnapshot(data);
        setError('');
        setErrorCode('');
        setSelected(null);
      } catch (e) {
        setError(
          e instanceof Error && e.name !== 'AbortError'
            ? e.message
            : 'The refresh timed out. Please try again.',
        );
      } finally {
        clearTimeout(timeout);
        inflight.current = false;
        setLoading(false);
      }
    },
    [previewSnapshot],
  );
  useEffect(() => {
    const initial = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(initial);
      abort.current?.abort();
    };
  }, [refresh]);
  useEffect(() => {
    if (previewSnapshot) return;
    const id = setInterval(
      () => {
        if (document.visibilityState === 'visible') void refresh();
      },
      (snapshot?.settings.refreshSeconds ?? 300) * 1000,
    );
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh, snapshot?.settings.refreshSeconds, previewSnapshot]);
  const filtered = useMemo(
    () => filterClasses(snapshot?.classes ?? [], filters),
    [snapshot, filters],
  );
  const totals = summarize(filtered),
    events = milestones(
      filtered,
      snapshot?.reportingDate ?? '2000-01-01',
      snapshot?.settings.milestoneDays ?? 30,
    );
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const av = sortValue(a, sort.key),
          bv = sortValue(b, sort.key);
        if (av === null) return bv === null ? 0 : 1;
        if (bv === null) return -1;
        return (
          (typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { numeric: true })) *
          (sort.asc ? 1 : -1)
        );
      }),
    [filtered, sort],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sorted.length / 10) - 1)),
    displayed = sorted.slice(currentPage * 10, currentPage * 10 + 10);
  const change = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  const activeFilters = Object.keys(defaultFilters).filter(
    (k) => filters[k as keyof Filters] !== defaultFilters[k as keyof Filters],
  ).length;
  const options = (key: 'course' | 'category' | 'institution' | 'region' | 'status' | 'batch') =>
    [...new Set((snapshot?.classes ?? []).map((r) => r[key]).filter(Boolean))].sort();
  const filterSelect = (
    key: 'course' | 'category' | 'institution' | 'region' | 'status' | 'batch',
    label: string,
  ) => (
    <label className="select-field" key={key}>
      <span>{label}</span>
      <select aria-label={label} value={filters[key]} onChange={(e) => change(key, e.target.value)}>
        <option value="">All {label.toLowerCase()}</option>
        {options(key).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to overview
      </a>
      <main id="main" className="main">
        {previewSnapshot && (
          <div className="preview-banner">
            DEVELOPMENT PREVIEW · Synthetic sample data · Not connected to Google Sheets
          </div>
        )}
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="line" /> THE BIG PICTURE
            </div>
            <h1>
              Executive class overview<span>.</span>
            </h1>
            <p>Every class. Every milestone. One clear view.</p>
          </div>
          <div className="heading-actions">
            <span className="source-chip">
              <span className="sheets-icon" aria-hidden="true">
                ▦
              </span>{' '}
              K2K Data Tracker <span className="tiny-dot" />
            </span>
            <button
              disabled={loading || !!previewSnapshot}
              className="button"
              onClick={() => refresh(true)}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>
        <div className="view-nav">
          <span className="active">
            <SlidersHorizontal size={15} /> Overview
          </span>
          <span className="view-date">
            <CalendarDays size={14} />
            {snapshot ? `As of ${snapshot.reportingDate} · Manila` : 'Live spreadsheet overview'}
          </span>
        </div>
        <div aria-live="polite" className="refresh-status">
          {snapshot && (
            <>
              <span>
                <i className={error ? 'dot amber' : 'dot'} />
                {error ? 'Stale data' : 'Last successfully fetched'} {time(snapshot.fetchedAt)} PHT
              </span>
              <span>
                Auto-refresh every {Math.round(snapshot.settings.refreshSeconds / 60)} min
              </span>
            </>
          )}
        </div>
        {error && (
          <div className="notice error-notice" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>
                {snapshot
                  ? 'Refresh failed — showing last good data'
                  : errorCode === 'configuration'
                    ? 'Connection setup required'
                    : 'Data unavailable'}
              </strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        {!snapshot && !error && (
          <div className="loading-state" aria-label="Loading classes">
            <div className="skeleton-grid">
              {[0, 1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
            <p>Reading the latest class overview…</p>
          </div>
        )}
        {snapshot && (
          <>
            {snapshot.warnings.map((w) => (
              <div className="notice" key={w}>
                {w}
              </div>
            ))}
            <section className="metrics" aria-label="Executive summary">
              <article className="metric">
                <div className="metric-label">
                  Total classes
                </div>
                <div className="metric-value">{number(totals.total)}</div>
                <p>
                  <span className="accent">{totals.courses} distinct courses</span> represented
                </p>
              </article>
              <article className="metric">
                <div className="metric-label">
                  Training institutes <span className="metric-symbol">⌂</span>
                </div>
                <div className="metric-value">{number(totals.institutes)}</div>
                <p>
                  Across {new Set(filtered.map((r) => r.region).filter(Boolean)).size} reported
                  regions
                </p>
              </article>
              <article className="metric">
                <div className="metric-label">
                  Reported participants <Users size={17} />
                </div>
                <div className="metric-value">{number(totals.participants)}</div>
                <p>
                  {totals.unknownCounts ? (
                    <span className="attention-text">
                      {totals.unknownCounts}{' '}
                      {totals.unknownCounts === 1 ? 'class has' : 'classes have'} no valid count
                    </span>
                  ) : (
                    'Counts recorded for every class'
                  )}
                </p>
              </article>
              <article className="metric attention">
                <div className="metric-label">
                  Needs a closer look <AlertCircle size={17} />
                </div>
                <div className="metric-value">
                  {number(totals.review)}
                  <span className="metric-unit">classes</span>
                </div>
                <button
                  className="metric-link"
                  onClick={() => change('reviewOnly', !filters.reviewOnly)}
                >
                  {filters.reviewOnly ? 'Show all classes' : 'Review missing or conflicting data'}{' '}
                  <ChevronRight size={14} />
                </button>
              </article>
            </section>
            <div className="filter-context">
              {activeFilters ? (
                <>
                  <ListFilter size={13} />
                  {activeFilters} active {activeFilters === 1 ? 'filter' : 'filters'} · All figures
                  reflect this view
                </>
              ) : (
                <>All active classes · Participant places, not unique learners</>
              )}
            </div>
            <section className="class-section" aria-labelledby="classes-heading">
              <div className="section-heading">
                <div>
                  <h2 id="classes-heading">
                    Class overview <span className="count-pill">{totals.total}</span>
                  </h2>
                  <p>The details behind your delivery.</p>
                </div>
                <button
                  className={`button subtle ${expanded ? 'selected' : ''}`}
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                  aria-controls="more-filters"
                >
                  <SlidersHorizontal size={14} /> {expanded ? 'Fewer filters' : 'More filters'}{' '}
                  {activeFilters > 0 && <span className="count-pill">{activeFilters}</span>}
                </button>
              </div>
              <div className="view-controls">
                <div className="view-switch" role="group" aria-label="Class view">
                  <button aria-pressed={view === 'table'} onClick={() => setView('table')}>
                    Table view
                  </button>
                  <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>
                    Calendar view
                  </button>
                </div>
                {view === 'table' && (
                  <details className="column-picker">
                    <summary>
                      Columns{' '}
                      <span>
                        {visibleColumns.length} / {columns.length}
                      </span>
                    </summary>
                    <fieldset>
                      <legend>Visible columns</legend>
                      {columns.map((c) => (
                        <label key={c.key}>
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(c.key)}
                            disabled={c.key === 'course'}
                            onChange={(e) =>
                              updateColumns(
                                e.target.checked
                                  ? [...visibleColumns, c.key]
                                  : visibleColumns.filter((key) => key !== c.key),
                              )
                            }
                          />
                          {c.title}
                          {c.key === 'course' ? ' (always shown)' : ''}
                        </label>
                      ))}
                      <button
                        className="button"
                        onClick={() => updateColumns(columns.map((c) => c.key))}
                      >
                        Show all columns
                      </button>
                    </fieldset>
                  </details>
                )}
              </div>
              <div className="filters">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search classes"
                    value={filters.search}
                    onChange={(e) => change('search', e.target.value)}
                    placeholder="Search courses, institutes, locations…"
                  />
                  {filters.search && (
                    <button aria-label="Clear search" onClick={() => change('search', '')}>
                      <X size={14} />
                    </button>
                  )}
                </label>
                {filterSelect('category', 'Categories')}
                {filterSelect('status', 'Statuses')}
                <button
                  className="reset-button"
                  onClick={() => {
                    setFilters({ ...defaultFilters });
                    setPage(0);
                  }}
                >
                  Reset
                </button>
              </div>
              {expanded && (
                <div className="expanded-filters" id="more-filters">
                  {filterSelect('course', 'Courses')}
                  {filterSelect('institution', 'Institutes')}
                  {filterSelect('region', 'Regions')}
                  {options('batch').length > 0 && filterSelect('batch', 'Batches')}
                  <label className="select-field">
                    <span>Archive</span>
                    <select
                      value={filters.archive}
                      onChange={(e) => change('archive', e.target.value as Filters['archive'])}
                    >
                      <option value="active">Active classes</option>
                      <option value="archived">Archived classes</option>
                      <option value="all">All classes</option>
                    </select>
                  </label>
                  <fieldset className="date-filter">
                    <legend>Planned class opening</legend>
                    <label>
                      From
                      <input
                        type="date"
                        value={filters.from}
                        onChange={(e) => change('from', e.target.value)}
                      />
                    </label>
                    <span>—</span>
                    <label>
                      To
                      <input
                        type="date"
                        value={filters.to}
                        onChange={(e) => change('to', e.target.value)}
                      />
                    </label>
                  </fieldset>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={filters.includeUndated}
                      onChange={(e) => change('includeUndated', e.target.checked)}
                    />{' '}
                    Include undated / invalid openings
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={filters.reviewOnly}
                      onChange={(e) => change('reviewOnly', e.target.checked)}
                    />{' '}
                    Only classes needing review
                  </label>
                  <p className="filter-help">
                    Date range uses planned class opening. Month-only dates match overlapping
                    months.{' '}
                    {snapshot.classes.filter((r) => !dateBounds(r.dates.plannedOpening)).length}{' '}
                    classes have no valid planned opening.
                  </p>
                  {filters.from && filters.to && filters.from > filters.to && (
                    <p role="alert" className="attention-text">
                      The start date is after the end date. Correct the date range.
                    </p>
                  )}
                </div>
              )}
              {view === 'calendar' ? (
                <CourseCalendar
                  records={filtered}
                  today={snapshot.reportingDate}
                  onSelect={setSelected}
                />
              ) : (
                <>
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Class table; scroll horizontally for all fields"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          {columns
                            .filter((c) => visibleColumns.includes(c.key))
                            .map((c) => (
                              <th
                                key={c.key}
                                aria-sort={
                                  sort.key === c.key
                                    ? sort.asc
                                      ? 'ascending'
                                      : 'descending'
                                    : 'none'
                                }
                              >
                                <button
                                  onClick={() => {
                                    setSort((s) => ({
                                      key: c.key,
                                      asc: s.key === c.key ? !s.asc : true,
                                    }));
                                    setPage(0);
                                  }}
                                >
                                  {c.title}
                                  {sort.key === c.key ? (
                                    <ArrowDown
                                      size={12}
                                      style={{ transform: sort.asc ? 'rotate(180deg)' : undefined }}
                                    />
                                  ) : (
                                    <ArrowDownUp size={11} />
                                  )}
                                </button>
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayed.map((r) => (
                          <tr key={r.key}>
                            <td>
                              <button className="course-button" onClick={() => setSelected(r)}>
                                {r.course || 'Course not recorded'}
                                <ChevronRight size={14} />
                              </button>
                              <span className="row-caption">
                                {r.classId || `Source row ${r.sourceRow}`}
                                {r.warnings.length > 0 && (
                                  <span className="review-indicator">
                                    <AlertCircle size={11} />
                                    {r.warnings.length} checks
                                  </span>
                                )}
                              </span>
                            </td>
                            <td
                              hidden={!visibleColumns.includes('institution')}
                              className="institute-cell"
                            >
                              {r.institution || <span className="muted">Not recorded</span>}
                            </td>
                            <td hidden={!visibleColumns.includes('category')}>
                              <span className={`category ${r.category === 'AI' ? 'ai' : ''}`}>
                                {r.category}
                              </span>
                            </td>
                            <td hidden={!visibleColumns.includes('region')}>{r.region || '—'}</td>
                            <td hidden={!visibleColumns.includes('province')}>
                              {r.province || '—'}
                            </td>
                            <td hidden={!visibleColumns.includes('municipality')}>
                              {r.municipality || '—'}
                            </td>
                            <td hidden={!visibleColumns.includes('batch')}>{r.batch || '—'}</td>
                            <td
                              hidden={!visibleColumns.includes('participants')}
                              className="number-cell"
                            >
                              {r.participants.value === null ? (
                                <span className="unknown">Unknown</span>
                              ) : (
                                number(r.participants.value)
                              )}
                            </td>
                            {(
                              [
                                'plannedOpening',
                                'actualOpening',
                                'projectedEnd',
                                'actualEnd',
                              ] as const
                            ).map((f) => (
                              <td key={f} hidden={!visibleColumns.includes(f)}>
                                <span
                                  className={r.dates[f].kind === 'invalid' ? 'invalid-value' : ''}
                                >
                                  {displayDate(r.dates[f])}
                                </span>
                                {r.dates[f].kind === 'month' && (
                                  <small className="cell-note">Month only</small>
                                )}
                              </td>
                            ))}
                            <td hidden={!visibleColumns.includes('status')}>
                              <Status record={r} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {displayed.length === 0 && (
                    <div className="empty-state">
                      <Search size={25} />
                      <h3>
                        {snapshot.classes.length
                          ? 'No classes match this view'
                          : 'No classes recorded yet'}
                      </h3>
                      <p>
                        {snapshot.classes.length
                          ? 'Adjust your filters or reset to see active classes.'
                          : 'Add a class row in Sheet5, then refresh this overview.'}
                      </p>
                      {activeFilters > 0 && (
                        <button
                          className="button"
                          onClick={() => setFilters({ ...defaultFilters })}
                        >
                          Reset filters
                        </button>
                      )}
                    </div>
                  )}
                  <div className="table-footer">
                    <span>
                      {sorted.length
                        ? `${currentPage * 10 + 1}–${Math.min(currentPage * 10 + 10, sorted.length)} of ${sorted.length} classes`
                        : '0 classes'}
                      <span className="table-hint"> · Scroll for schedule and status →</span>
                    </span>
                    <div>
                      <button
                        aria-label="Previous page"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                        className="icon-button"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        {currentPage + 1} / {Math.max(1, Math.ceil(sorted.length / 10))}
                      </span>
                      <button
                        aria-label="Next page"
                        disabled={(currentPage + 1) * 10 >= sorted.length}
                        onClick={() => setPage(currentPage + 1)}
                        className="icon-button"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
            <section className="bottom-grid">
              <article className="panel milestone-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">WHAT’S NEXT</span>
                    <h2>On the horizon</h2>
                  </div>
                  <span className="soft-tag">Next {snapshot.settings.milestoneDays} days</span>
                </div>
                <div className="milestones">
                  {events.slice(0, 5).map((e) => (
                    <button
                      className="milestone"
                      key={`${e.record.key}:${e.field}`}
                      onClick={() => setSelected(e.record)}
                    >
                      <span className="calendar-tile">
                        <CalendarDays size={19} />
                      </span>
                      <span>
                        <strong>{e.label}</strong>
                        <small>{e.record.institution || e.record.course}</small>
                      </span>
                      <span className="milestone-date">
                        {displayDate(e.date)}
                        <small>
                          {e.timing}
                          {e.date.kind === 'month' ? ' · month only' : ''}
                        </small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {events.length === 0 && (
                    <p className="panel-empty">
                      No dated milestones in this window for the selected classes.
                    </p>
                  )}
                </div>
                {events.length > 5 && (
                  <details className="more-milestones">
                    <summary>View {events.length - 5} more milestones</summary>
                    {events.slice(5).map((e) => (
                      <button
                        key={`${e.record.key}:${e.field}`}
                        onClick={() => setSelected(e.record)}
                      >
                        {displayDate(e.date)} · {e.label} · {e.record.institution}
                      </button>
                    ))}
                  </details>
                )}
                <p className="panel-footnote">Planned dates are not confirmation of completion.</p>
              </article>
              <article className="panel delivery-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">DELIVERY AT A GLANCE</span>
                    <h2>Where classes stand</h2>
                  </div>
                  <span className="icon-badge">
                    <Check size={17} />
                  </span>
                </div>
                <div className="status-summary">
                  {Object.entries(totals.statuses).map(([status, count]) => (
                    <div key={status}>
                      <div>
                        <span>{status}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="status-track">
                        <span
                          style={{ width: `${totals.total ? (count / totals.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {!totals.total && <p className="panel-empty">No classes in this view.</p>}
                </div>
                <details className="status-help">
                  <summary>
                    <CircleHelp size={14} /> How statuses are determined
                  </summary>
                  <p>
                    Recorded status is shown when present. Otherwise: Classes ended requires a
                    confirmed actual end; Ongoing requires a confirmed actual opening; Enrollment
                    open requires a valid current enrollment window; Scheduled requires a future
                    planned opening or enrollment start. Awaiting update means insufficient
                    evidence. Undetermined means conflicting or imprecise evidence prevents a
                    reliable conclusion.
                  </p>
                  <p>
                    Actual dates in the future do not prove an event occurred. A month is only
                    treated as past after its last day. Graduation dates and notes are not outcome
                    totals.
                  </p>
                </details>
              </article>
            </section>
          </>
        )}
        <div className="provenance">
          <span>
            <span className="tiny-dot" /> Read-only · Source of truth: Google Sheets
          </span>
          <details>
            <summary>Refresh & source details</summary>
            <p>
              Last attempt: {time(attempt)} PHT
              <br />
              Last successful fetch: {time(snapshot?.fetchedAt ?? null)} PHT
              <br />
              Latest recorded Updated At: {snapshot?.sourceUpdatedAt ?? 'Not available'}
              {snapshot?.sourceUpdatedAt
                ? ` (${snapshot.sourceUpdatedCoverage} of ${snapshot.classes.length} rows populated)`
                : ''}
              <br />
              Reporting timezone: Asia/Manila
              <br />
              Source timezone: {snapshot?.sourceTimeZone ?? 'Not yet read'} · Locale:{' '}
              {snapshot?.locale ?? 'Not yet read'}
            </p>
            <p>Fetch time is not the time someone edited the spreadsheet.</p>
          </details>
        </div>
      </main>
      <Footer />
      {selected && <DetailDrawer record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
