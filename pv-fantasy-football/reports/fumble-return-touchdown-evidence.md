# PV Fantasy Football — Fumble-return Touchdown Evidence

Status: **AUTHORITATIVE FINAL-STAT-BOOK FALLBACK PROVEN; LIVE SIDEARM SUMMARY FIELD STILL UNAVAILABLE**

## Proven example

Official event: Florida at Alabama, September 20, 2014.

- Official team totals: Florida recorded two fumble returns for 76 yards and one touchdown.
- Official individual defensive table: Keanu Neal (`#42`, rendered `Neal,K.`) recorded `FR-Yds 1-49`.
- Official scoring summary: `Neal,K. 49 yd fumble recovery` at 09:24, explicitly a touchdown.
- The remaining Florida recovery was Dante Fowler Jr. for 27 yards and no touchdown, reconciling the player rows to the team `2-76-1` total.

This proves player attribution only when the official final defensive table, scoring summary, and team fumble-return touchdown total agree. It does not make ambiguous live play-by-play roles authoritative.

## Adapter consequence

The SIDEARM summary mapping remains unchanged and unsupported for FF/FR/fumble-return TD. A separate official-final-stat-book fallback contract now accepts explicitly sourced, final, reconciled player values. Missing, duplicate, invalid, non-HTTPS, or non-final fallback rows fail closed.

Final publication must remain blocked until either the live provider supplies a proven aggregate field or the official final-stat-book fallback is available and reconciled.
