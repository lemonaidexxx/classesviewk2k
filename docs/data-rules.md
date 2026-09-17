# Data definitions

## Status precedence

The table displays recorded Status when supplied, otherwise the inferred status. Both appear in the drawer; differences are flagged.

| Inferred status | Evidence                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Classes ended   | Valid actual end completely on/before the reporting day, with no contradictory actual opening/end sequence.               |
| Ongoing         | Actual opening completely on/before today and no confirmed past actual end. Invalid actual end makes status undetermined. |
| Enrollment open | Valid enrollment window definitely includes today, with no stronger actual evidence.                                      |
| Scheduled       | Valid future planned opening or enrollment start, without stronger evidence.                                              |
| Awaiting update | Insufficient evidence.                                                                                                    |
| Undetermined    | Contradictory actual sequence, invalid decisive actual dates, or month-level actual timing spanning today.                |

A month-only actual event is past only once the entire month is on or before today. Future actual fields do not prove occurrence. Invalid enrollment data still creates warnings but does not erase reliable actual-opening evidence. Graduation dates and notes never become completion or placement counts.

## Dates and counts

The adapter reads displayed values, effective values, and number formats together. Native serial dates preserve their represented calendar day. Text uses explicit parsers; malformed and ambiguous input remains visible with warnings and source references.

Supported years are 1900–2100. Native year `0226` is rejected, not repaired to 2026. `25 Septembef 2026` and `20 Augut 2026` are invalid. Text such as `09/10/2026` is ambiguous even in a US-locale sheet; use a named month or ISO date.

Participant totals sum valid nonnegative whole counts. Missing/invalid counts have separate coverage warnings; explicit zero is reported. Distinct courses/institutions use trimmed case-insensitive names from represented class rows, independent of catalog size.

## Categories and identity

Precedence: explicit row Category, then exactly one catalog Course ID match, then preceding section. All nonempty sources are compared and disagreements flagged. Missing/multiply matched catalog IDs and inconsistent names are flagged; unknown category labels are preserved.

Persistent IDs are assigned only by the owner helper. Duplicate IDs never merge rows. Source row and snapshot keys are diagnostic/rendering references, not permanent identity. Archive TRUE/YES/1 hides a class only from the default view; unrecognized values remain visible with a warning.

## Public boundary

The product decision is no sign-in. Public GET responses contain the class fields and warnings needed by the dashboard. There are no learner/contact reads, client-selectable source ranges, browser credentials, or spreadsheet writes. Public dashboard access does not grant Google spreadsheet edit permission.
