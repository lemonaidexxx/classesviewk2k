# Verification report — 17 September 2026

## Completed locally

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript / generated route types | Passed |
| Vitest | 35 tests passed in 7 test files |
| Production build | Passed, Next.js 16.3.5 |
| Desktop and mobile browser tests | 6 passed using installed Chrome |
| Production `/` | HTTP 200, no sign-in |
| Production `/preview` with preview flag enabled | HTTP 404 |
| Production `/api/dashboard` without credentials | HTTP 503 configuration error, no fabricated totals |
| Production POST `/api/dashboard` | HTTP 405 |
| Secret environment names in client static chunks | No matches |
| Git diff whitespace checks | Passed |
| Operational source snapshot | Stored only in ignored `private/`, not staged or committed |

Tests cover strict dates/counts, category dividers and aliases, separate cohorts, added/reordered rows, duplicate IDs, category conflicts, archived records, status inference, month precision, consistent filters, bounded source reads, source allowlists, GET-only access, helper repeatability, caching/retries, stale-data recovery, configuration errors, drawer focus/Escape, responsive layout, and footer pointer/reduced-motion behavior.

The real Sheet5 snapshot was read through the connected Google Sheets tool and validated locally: **17 classes, 8 AI, 9 non-AI, 8 course names, 381 reported participant places across 16 populated count cells, and one missing count**. The snapshot was never used as production fallback data. CI skips this private-snapshot test when the ignored file is absent and uses synthetic fixtures for the rest.

Desktop/mobile screenshots are local generated artifacts using visibly labeled synthetic data. They were inspected for layout; no Horizon pixel-parity claim is made because the approved design is new. Browser verification found and fixed a drawer focus-wrap issue. A stale Turbopack development cache referring to removed sign-in routes was cleared; the final browser rerun passed.

The owner setup helper was tested against a mocked spreadsheet for repeatability and value/ID preservation. The supplied Apps Script editor was inspected and contained only the default `myFunction` stub. No live script or spreadsheet mutations were performed.

## Not yet verified live

- Service-account authentication against the live Sheets API from the deployed application: runtime credentials are not configured.
- A deployed Vercel URL: hosting sign-in is unfinished. Automatic approval review blocked continuing the GitHub-to-Vercel OAuth/organization-SSO flow.
- Real spreadsheet edits flowing through a running deployment, because there is no configured deployment yet.
- Running the optional setup helper against the live workbook; this remains an owner-run action.

The public no-sign-in behavior follows the user's updated requirement. Source runtime credentials remain server-only. See the README for the two environment variables and deployment steps.
