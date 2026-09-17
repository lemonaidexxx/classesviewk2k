'use client';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, X, AlertCircle } from 'lucide-react';
import { dateFields, dateLabels, type ClassRecord } from '@/lib/model';
import { displayDate } from '@/lib/dates';
import { SPREADSHEET_ID } from '@/lib/sheets-policy';
export default function DetailDrawer({
  record,
  onClose,
}: {
  record: ClassRecord;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!,
      prior = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, summary, [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length && !el.hasAttribute('disabled'));
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => {
      dialog.removeEventListener('keydown', trap);
      dialog.close();
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby="class-title"
      onCancel={onClose}
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          e.clientX < e.currentTarget.getBoundingClientRect().left
        )
          onClose();
      }}
    >
      <div className="drawer-top">
        <span className="eyebrow">CLASS DETAILS</span>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close class details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <span className={`category ${record.category === 'AI' ? 'ai' : ''}`}>{record.category}</span>
      <h2 id="class-title">{record.course || 'Course not recorded'}</h2>
      <p className="drawer-institute">{record.institution || 'Institute not recorded'}</p>
      <dl className="detail-grid">
        <div>
          <dt>Class ID</dt>
          <dd>{record.classId || 'Not assigned'}</dd>
        </div>
        <div>
          <dt>Batch / cohort</dt>
          <dd>{record.batch || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Reported participants</dt>
          <dd>{record.participants.value ?? 'Unknown'}</dd>
        </div>
        <div>
          <dt>Target participants</dt>
          <dd>{record.targetParticipants.value ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{record.region || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {[record.municipality, record.province].filter(Boolean).join(', ') || 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt>Recorded status</dt>
          <dd>{record.recordedStatus || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Inferred status</dt>
          <dd>{record.inferredStatus}</dd>
        </div>
        <div>
          <dt>Archived</dt>
          <dd>{record.archived ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Source Updated At</dt>
          <dd>{record.updatedAt || 'Not recorded'}</dd>
        </div>
      </dl>
      <h3>Schedule & milestones</h3>
      <div className="date-details">
        {dateFields.map((field) => (
          <div key={field}>
            <span>
              {dateLabels[field]}
              <small>
                {field.startsWith('actual')
                  ? 'Actual field · future entries are unconfirmed'
                  : field === 'graduation' || field === 'jobFacilitation'
                    ? 'Recorded date · not an outcome count'
                    : 'Planned'}
              </small>
            </span>
            <span className={record.dates[field].kind === 'invalid' ? 'invalid-value' : ''}>
              {displayDate(record.dates[field])}
              <small title={record.dates[field].cell}>
                {record.dates[field].kind === 'month' ? 'Month only · ' : ''}
                {record.dates[field].cell}
              </small>
            </span>
          </div>
        ))}
      </div>
      <h3>Notes</h3>
      <p className="preserve-text">{record.notes || 'No notes recorded.'}</p>
      <h3>Additional notes</h3>
      <p className="preserve-text">{record.additionalNotes || 'No additional notes recorded.'}</p>
      <h3>
        Data review <span className="count-pill">{record.warnings.length}</span>
      </h3>
      {record.warnings.length ? (
        <ul className="warning-list">
          {record.warnings.map((w, i) => (
            <li key={i}>
              <AlertCircle size={15} />
              <span>
                {w.message}
                {w.cell && <small>{w.cell}</small>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No validation warnings.</p>
      )}
      <details className="source-values">
        <summary>Original source values</summary>
        <dl>
          {dateFields.map((f) => (
            <div key={f}>
              <dt>{dateLabels[f]}</dt>
              <dd>{record.dates[f].raw || '(blank)'}</dd>
            </div>
          ))}
          <div>
            <dt>Participant count</dt>
            <dd>{record.participants.raw || '(blank)'}</dd>
          </div>
        </dl>
      </details>
      <a
        className="button source-link"
        target="_blank"
        rel="noreferrer"
        href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=1483800666&range=A${record.sourceRow}:P${record.sourceRow}`}
      >
        View source row {record.sourceRow}
        <ArrowUpRight size={16} />
      </a>
      <p className="fine-print">
        Source row is for troubleshooting, not permanent identity. Edits happen in Google Sheets.
      </p>
    </dialog>
  );
}
