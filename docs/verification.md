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

## Production launch

Live URL: https://classesviewk2k.vercel.app

- Vercel project `classesviewk2k` in `lemonaidexxxs-projects`, connected to `lemonaidexxx/classesviewk2k`. Production tracks `codex/k2k-executive-overview`; pushes to this branch deploy automatically.
- Vercel CLI 59.20.0 authenticated as `lemonaidexxx`. Official Vercel MCP registered and OAuth login completed; its tools require a subsequent Codex tool refresh/session before tool-level verification. Nine official standalone guidance skills installed for Codex.
- Dedicated Google Cloud project `K2K Executive Overview` (`trim-sunlight-508905-h3`), Sheets API enabled, dedicated service account created without project roles and explicitly shared onto the tracker as Viewer.
- Both Google runtime variables are Vercel Production Secrets. No key or source snapshot is committed; `.vercelignore` excludes credentials, private snapshots, exports, and local artifacts from CLI uploads.
- Anonymous production `/` and `/api/dashboard` return 200. Live totals match the source baseline above. Course, institution, participant text, and raw column P notes match across all 17 rows (68 comparisons).
- Manual live refresh succeeds. Reporting uses Asia/Manila with source locale en_US and timezone Asia/Shanghai.
- Production `/preview` returns 404; unsupported source query parameters return 400; POST `/api/dashboard` returns 405.
- Source boundary/cache tests and the private baseline test passed again (5 tests); component stale-data retention/recovery and configuration-error tests passed again (2 tests).
- Existing tracker general access was already “Anyone with the link — Editor” and was preserved. The runtime still requests the read-only scope and has no write path.

The earlier hosting authorization handoff was completed by the owner. Google Sheets cells and the linked Apps Script project were not modified during launch. Only the requested service-account sharing grant was added.

## Remaining optional owner checks

- Observe a future operational spreadsheet edit flowing through refresh; launch verification made no test edits to the source.
- Run the optional setup helper against the live workbook if permanent Class IDs/supporting tabs are desired. Missing-ID warnings remain visible until then.

The public no-sign-in behavior follows the user's updated requirement. Source runtime credentials remain server-only. See the README for the two environment variables and deployment steps.
