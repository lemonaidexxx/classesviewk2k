# How to add and update courses/classes

Open **K2K Data Tracker → Sheet5**. Keep headers on row 2. One row is one class or cohort; two batches of the same course need separate rows.

1. If Courses exists, optionally add a unique Course ID, name, category, and Active value. You can also type a new course name directly in Sheet5.
2. Add a class row. Copy formatting if useful, but never copy another class's Class ID. Complete the course, institute, location, dates, and count you know.
3. Optionally enter Course ID to link the catalog, Category to override legacy section placement, and Batch/Cohort to distinguish batches.
4. Update the row over time. Use actual dates only once known; future actual dates are flagged as unconfirmed.
5. Refresh the dashboard or wait for its normal five-minute refresh. No developer or redeployment is needed.

| Field                  | Guidance                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Number of Participants | Whole number, zero or greater. Blank means unknown. Do not put counts only in Notes.                 |
| Dates                  | Prefer native Sheets dates displayed with day, month, and year, or text such as `17 September 2026`. |
| Month-only dates       | Use `September 2026` if the day is unknown; the dashboard retains month precision.                   |
| TBA / TO BE DETERMINED | Pending information, not a date.                                                                     |
| Notes / column P       | Class-level notes; P is Additional Notes and must not be replaced with Class ID.                     |
| Status                 | Optional recorded status, distinct from the application's inference.                                 |
| Updated At             | Optional date you actually updated the row; manually maintained, not an automatic audit trail.       |
| Archived               | TRUE hides a class by default; FALSE restores it. The archive filter can show either.                |

The website is public without sign-in. Keep displayed class fields and notes appropriate for that audience. Learners and Contacts are not read by the application.

## Optional owner setup

Inspect the existing Apps Script project before adding `scripts/setup-sheet.gs` as a separate file. Run `setupK2KTracker()` manually with an editor-authorized account. No web-app deployment or automatic trigger is needed. The website's Viewer account never invokes it.

The helper checks headers, appends missing optional columns after all occupied columns (and always after P), assigns UUID Class IDs only where missing, creates missing Courses and Dashboard_Settings tabs, and supplies missing defaults. It preserves existing values/formulas and adds non-rejecting course/archive dropdowns. Duplicate IDs are logged for owner review rather than silently changed.

Re-run after adding rows to assign missing IDs. It does not duplicate tabs or reset populated values. The dashboard works without setup but marks missing IDs for review. Course IDs are staff-maintained unique stable labels such as `COURSE-001`; enter the matching ID on linked class rows. Inactive catalog courses do not remove existing classes.

## Resolve review flags

Open a class to see warnings, raw values, and source cell references. **View source row** locates the row in Sheets; normal Google spreadsheet permissions still apply.

Fix misspelled dates in Sheets; the dashboard never guesses corrections. Review end-before-start sequences and future actual entries. If a duplicate Class ID belongs to a newly copied class, clear only that new row's ID and re-run the helper; keep the original class's identity. Separate batches must not be merged.

The `AI COURSE` and `NON AI COURSE` section labels apply to following class rows. Before sorting/moving legacy rows, fill their explicit Category or retain the right section grouping. Category disagreements are flagged, not silently resolved.
