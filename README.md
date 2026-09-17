# K2K Executive Class Overview

A read-only executive dashboard for classes maintained in **K2K Data Tracker → Sheet5**. Built with Next.js, TypeScript, and the Google Sheets API, ready for Vercel's Node.js runtime.

**Live dashboard:** https://classesviewk2k.vercel.app — connected directly to Google Sheets. Vercel production tracks `codex/k2k-executive-overview`. See [launch verification](docs/verification.md) for the validated source totals and deployment details.

**No sign-in is required**, as requested. The dashboard and `/api/dashboard` endpoint are publicly readable, including class notes and source references. The spreadsheet itself need not be public. Runtime credentials stay on the server, and the application cannot edit the tracker. There is no enrollment system or second class database.

## Views and display preferences

Use **Columns** above the table to show or hide fields. Your selection is stored in this browser; the course column stays visible so class details remain accessible. **Show all columns** restores the full table.

Switch to **Calendar view** to browse courses by month. **Calendar date** chooses the schedule field (planned opening by default). The calendar shares all dashboard filters and opens the same class details. Month-only dates appear below the grid without an invented day; undated or invalid values remain available in a separate list. Phones show the calendar as a daily agenda.

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
cp .env.example .env.local
# Set the two service-account values in .env.local.
npm run dev
```

PowerShell: use `Copy-Item .env.example .env.local` and, when script execution is restricted, `npm.cmd`. Open `http://localhost:3000`. Without credentials, the dashboard shows a configuration error, never sample data or zero totals.

For an explicitly labeled **synthetic development preview**, set `ENABLE_DEV_PREVIEW=true` in the development environment and open `/preview`. That route always returns 404 in production, even if the flag is set. The normal dashboard never falls back to fixtures.

## Connect Google Sheets

1. Enable the Google Sheets API in your Google Cloud project and create a dedicated service account.
2. Share **K2K Data Tracker** with that service account email as **Viewer**, not Editor.
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `.env.local` or Vercel environment settings. Use the PEM key with real newlines or escaped `\n`. Do not commit the credential JSON file.
4. Open the dashboard and refresh. No OAuth client, login screen, or executive allowlist is needed.

The spreadsheet ID is fixed in `src/lib/sheets-policy.ts`: `1krs7YPHJvYqoKcegcTq_ri8wHWq44ar_zjdvdvlchq0`.

Permitted data tabs are **Sheet5**, **Courses**, and **Dashboard_Settings**. Workbook metadata is read for tab bounds/locale/timezone, but cell records from **Learners**, **Contacts**, or other tabs are never read. Callers cannot supply spreadsheet IDs or ranges. The runtime requests only `spreadsheets.readonly`. Viewer access still covers the whole workbook; the tab allowlist is an application restriction, not per-tab Google authorization.

## Deploy to Vercel

1. Import `lemonaidexxx/classesviewk2k` into Vercel. Select the implementation branch, the **Next.js** preset, and repository root.
2. Select Node.js **24.x**, install command `npm ci`, and build command `npm run build`. Do not use static export or GitHub Pages.
3. Add `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` as sensitive server environment variables. Never use `NEXT_PUBLIC_` for secrets.
4. Deploy. If Vercel deployment protection is enabled, adjust the intended production deployment's protection to match the no-sign-in requirement. The app itself has no authentication.
5. Verify the connection, counts, review flags, and refresh timestamps. Open the production URL in a signed-out browser; confirm `/preview` is unavailable and POST `/api/dashboard` returns 405.
6. Add a custom domain in Vercel if needed. Sheet edits require neither code changes nor redeployment.

Vercel supports Next.js server rendering and route handlers; see [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs). The adapter uses bounded [spreadsheets.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get) reads with cell field masks.

**Launch configuration:** a Vercel account/project and a Google service account with Viewer access and the two environment values. Development connector access is not a credential for the deployed application. The supplied Apps Script project has not been modified or deployed.

## Staff workflow

See [the maintenance guide](docs/maintenance.md): optionally add a course to Courses, add one class/cohort row in Sheet5, fill available information, update it over time, then refresh. New names and rows are discovered without code changes. A course with no class rows does not increase class counts.

The optional `scripts/setup-sheet.gs` helper creates supporting tabs, appends optional columns, and assigns persistent IDs. It is an **owner-run** tool, never called by the website. Review existing Apps Script code before adding it as a new file. Setup preserves P and existing values. Re-run after adding rows to assign missing IDs. The current tracker works before setup.

## Data behavior

- Headers are detected on row 1 or legacy row 2. Whitespace and documented aliases are supported, including `Training Institute ` and `Job Facilitarion`. Projected Class Opening is supported. When Notes is in P, unlabeled Q is Additional Notes; legacy unlabeled P remains supported. Explicit Additional Notes headers take precedence. Section rows provide legacy categories; blank separators are ignored.
- Each class row remains separate. Missing/duplicate IDs are warnings, not reasons to merge or discard rows. Snapshot-local keys are not permanent identities.
- Category precedence is explicit row → unambiguous linked Course ID category → section. Disagreements are flagged. Inactive catalog courses do not hide existing classes.
- Counts must be nonnegative integers. Missing/invalid counts remain unknown and appear in coverage warnings. Explicit zero is valid. Participants are places, not unique learners.
- Dates preserve raw text, validated values, precision, and cell references. Named-month dates, ISO dates, and unambiguous supported-locale numeric dates are parsed strictly. Supported years are 1900–2100. Typos and implausible native dates are not repaired.
- Month-only displays retain month precision even when their serial hides a day. Date-only values are not shifted between timezones. Reporting uses Asia/Manila; source timezone and locale remain visible separately.
- Recorded and inferred statuses are distinct. See [data rules](docs/data-rules.md) and the interface help for precedence and ambiguity handling.
- All metrics, milestones, and status bars share the table filters. Planned-opening ranges match overlapping months; undated/invalid dates have an inclusion control. Archives are excluded by default and reversible.

## Runtime and API

`GET /api/dashboard` returns a `DashboardSnapshot`: classes, raw/validated dates and counts, warnings, settings, source metadata, and fetch timestamps. `?refresh=1` requests a new read subject to a ten-second per-instance cooldown. Other query parameters and write methods are unsupported.

Allowed tabs are read in 500-row chunks using current allocated bounds, including blank gaps. A per-tab budget of 256 columns and 2 million allocated cells prevents unbounded reads; exceeding it produces an explicit error, never partial totals. No operational data is stored on disk or in a second database.

Per-instance caching lasts 60 seconds and coalesces concurrent reads. Browsers refresh every five minutes by default and pause periodic reads while hidden. Transient failures receive at most two retries per request; source access failures are not retried. Last good data stays in the open browser's memory during an outage and is visibly marked stale. A newly opened browser cannot recover another session's snapshot during an outage. For large public traffic, use Vercel firewall rate limiting to protect Sheets quotas.

Last successful fetch, last refresh attempt, and source Updated At are distinct. Updated At is read only from populated valid full dates, with coverage; fetch time is never treated as edit time. Dashboard_Settings accepts `refreshSeconds` (60–3600; default 300) and `milestoneDays` (1–365; default 30).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To use installed Chrome in PowerShell: set `$env:PLAYWRIGHT_CHANNEL='chrome'` before browser tests. GitHub Actions runs checks without credentials or operational data. Browser tests use the labeled development preview; production disallows it.

`tests/local-baseline.test.ts` optionally verifies a gitignored `private/source-snapshot.json` connector snapshot and is skipped in CI. Never commit that snapshot. Baseline expectations are 17 classes, 8 AI, 9 non-AI, 8 course names, 381 places across 16 populated counts, and one missing count; these are not production constants.

## Structure

```text
src/app/                 Next.js pages, read-only API, styles
src/components/          Dashboard, accessible drawer, footer effect
src/lib/                 Model, parser, selectors, server-only adapter, cache
scripts/setup-sheet.gs   Optional owner-run setup and persistent IDs
tests/                   Synthetic tests, optional private baseline, browser tests
docs/                    Maintenance, data definitions, verification report
```

Do not commit live exports, credentials, or personal records. The repository's original license is retained.
