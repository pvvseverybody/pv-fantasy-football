# PV Fantasy Football — Defensive-stat Fallback Research

Status: **PARTIAL — OFFICIAL FINAL STAT BOOK PROVES FF/FR COLUMNS; NONZERO FUMBLE-RETURN TD ATTRIBUTION REMAINS UNPROVEN**

## Findings

- The completed Rice–Prairie View SIDEARM `detail=full` summary does not expose aggregate forced-fumble or defensive fumble-recovery player fields.
- `FumbleRecoverer` occurrences in play-by-play are roles, not a sufficiently unambiguous individual-stat source, and are not mapped.
- The official final stat-book individual defensive table contains explicit `FF` and `FR-Yds` columns. It records Eric Zachery with one forced fumble and Prairie View with no defensive fumble recovery.
- The official team fumble-return line records zero returns, zero yards, and zero touchdowns in this game.
- Kickoff- and punt-return touchdowns remain distinct return categories and remain excluded from fantasy scoring.

## Safe fallback boundary

The official final stat book is an authoritative fallback for individual forced fumbles and defensive recoveries when its defensive table is available. A zero team fumble-return-TD total can be reconciled for this game. No inspected completed example proves how a **nonzero fumble-return touchdown** is attributed to an individual, so that category remains unsupported rather than inferred.

No historical or test values were written to production Google Sheets.
