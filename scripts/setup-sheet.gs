/**
 * OPTIONAL OWNER-RUN HELPER. Dashboard runtime never invokes this script.
 * Review the existing Apps Script project before adding this as a new file.
 * Run setupK2KTracker() manually; requires owner/editor Sheets authorization.
 */
const K2K_TRACKER_ID = '1krs7YPHJvYqoKcegcTq_ri8wHWq44ar_zjdvdvlchq0';
const K2K_OPTIONAL_HEADERS = [
  'Class ID',
  'Course ID',
  'Category',
  'Batch/Cohort',
  'Status',
  'Target Participants',
  'Archived',
  'Updated At',
];

function setupK2KTracker() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(K2K_TRACKER_ID);
    const sheet = book.getSheetByName('Sheet5');
    if (!sheet) throw new Error('Sheet5 is missing. No replacement table will be created.');
    const width = Math.max(16, sheet.getLastColumn());
    if (sheet.getMaxColumns() < width)
      sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
    const headers = sheet.getRange(2, 1, 1, width).getDisplayValues()[0];
    const normalized = headers.map(k2kNormalize);
    if (normalized.filter((v) => v === 'course').length !== 1)
      throw new Error('Expected a unique Course header on row 2.');
    K2K_OPTIONAL_HEADERS.forEach((header) => {
      if (normalized.filter((v) => v === k2kNormalize(header)).length > 1)
        throw new Error('Duplicate header: ' + header);
    });
    // Preflight existing supporting tables BEFORE performing any content writes.
    k2kValidateTab(book, 'Courses', ['Course ID', 'Course Name', 'Category', 'Active']);
    k2kValidateTab(book, 'Dashboard_Settings', ['Setting', 'Value']);
    const missing = K2K_OPTIONAL_HEADERS.filter((h) => normalized.indexOf(k2kNormalize(h)) === -1);
    if (missing.length) {
      // getLastColumn examines the whole sheet, including content far below row 2.
      // Always append after every used column AND legacy P; never fill a guessed gap.
      const first = Math.max(16, sheet.getLastColumn()) + 1,
        required = first + missing.length - 1;
      if (sheet.getMaxColumns() < required)
        sheet.insertColumnsAfter(sheet.getMaxColumns(), required - sheet.getMaxColumns());
      const candidate = sheet.getRange(1, first, Math.max(2, sheet.getLastRow()), missing.length);
      if (
        candidate.getDisplayValues().some((r) => r.some((v) => String(v).trim())) ||
        candidate.getFormulas().some((r) => r.some(Boolean))
      )
        throw new Error('Append range contains data or formulas. Stopping.');
      sheet.getRange(2, first, 1, missing.length).setValues([missing]);
    }
    const finalHeaders = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const idColumn = finalHeaders.map(k2kNormalize).indexOf('class id') + 1;
    const rows = sheet.getDataRange().getDisplayValues();
    const seen = {},
      duplicates = [];
    rows.slice(2).forEach((row, offset) => {
      if (!k2kClassRow(row)) return;
      const current = String(row[idColumn - 1] || '').trim();
      if (current) {
        if (seen[current]) duplicates.push(offset + 3);
        seen[current] = true;
      }
    });
    let assigned = 0;
    rows.slice(2).forEach((row, offset) => {
      if (!k2kClassRow(row) || String(row[idColumn - 1] || '').trim()) return;
      const cell = sheet.getRange(offset + 3, idColumn);
      // Preserve formulas (even formulas displaying an empty string) and concurrent edits.
      if (cell.getFormula() || cell.getValue() !== '') return;
      let id;
      do {
        id = Utilities.getUuid();
      } while (seen[id]);
      cell.setValue(id);
      seen[id] = true;
      assigned++;
    });
    const courses = k2kEnsureTab(book, 'Courses', [
      'Course ID',
      'Course Name',
      'Category',
      'Active',
    ]);
    const settings = k2kEnsureTab(book, 'Dashboard_Settings', ['Setting', 'Value']);
    const existingSettings = settings
      .getDataRange()
      .getDisplayValues()
      .slice(1)
      .map((r) => r[0]);
    [
      ['refreshSeconds', 300],
      ['milestoneDays', 30],
    ].forEach((pair) => {
      if (existingSettings.indexOf(pair[0]) === -1) settings.appendRow(pair);
    });
    const courseRange = courses.getRange(2, 2, Math.max(1, courses.getMaxRows() - 1), 1);
    const courseColumn = finalHeaders.map(k2kNormalize).indexOf('course') + 1;
    sheet
      .getRange(3, courseColumn, Math.max(1, sheet.getMaxRows() - 2), 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInRange(courseRange, true)
          .setAllowInvalid(true)
          .setHelpText('Optional catalog choice. New course names are allowed.')
          .build(),
      );
    const archiveColumn = finalHeaders.map(k2kNormalize).indexOf('archived') + 1;
    sheet
      .getRange(3, archiveColumn, Math.max(1, sheet.getMaxRows() - 2), 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['TRUE', 'FALSE'], true)
          .setAllowInvalid(true)
          .build(),
      );
    console.log(
      'Assigned ' +
        assigned +
        ' Class IDs. Existing values preserved. Duplicate ID rows requiring owner review: ' +
        (duplicates.join(', ') || 'none'),
    );
    return { assigned: assigned, duplicateRows: duplicates };
  } finally {
    lock.releaseLock();
  }
}
function k2kNormalize(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}
function k2kClassRow(row) {
  const values = row.map((v) => String(v || '').trim());
  if (values.every((v) => !v)) return false;
  return !(/^(AI COURSE|NON[ -]?AI COURSE)$/i.test(values[0]) && values.slice(1).every((v) => !v));
}
function k2kValidateTab(book, name, headers) {
  const sheet = book.getSheetByName(name);
  if (!sheet) return;
  const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (!headers.every((h, i) => k2kNormalize(actual[i]) === k2kNormalize(h)))
    throw new Error(
      name + ' exists with different headers. Review it manually; no headers will be overwritten.',
    );
}
function k2kEnsureTab(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
