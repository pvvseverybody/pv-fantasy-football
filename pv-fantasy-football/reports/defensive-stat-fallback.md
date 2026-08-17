# PV Fantasy Football — Defensive-stat Fallback Research

Status: **OFFICIAL FINAL-STAT-BOOK FF/FR AND NONZERO FUMBLE-RETURN TD ATTRIBUTION PROVEN; LIVE SUMMARY REMAINS UNSUPPORTED**

## Findings

- The completed Rice–Prairie View SIDEARM `detail=full` summary does not expose aggregate forced-fumble or defensive fumble-recovery player fields.
- `FumbleRecoverer` occurrences in play-by-play are roles, not a sufficiently unambiguous individual-stat source, and are not mapped.
- The official final stat-book individual defensive table contains explicit `FF` and `FR-Yds` columns. It records Eric Zachery with one forced fumble and Prairie View with no defensive fumble recovery.
- The official Rice team fumble-return line records zero returns, zero yards, and zero touchdowns in that game.
- A second official SIDEARM-hosted final book, Florida at Alabama on September 20, 2014, records Florida team fumble returns of `2-76-1`, Keanu Neal with `FR-Yds 1-49`, and an official scoring-summary 49-yard fumble-recovery touchdown credited to Neal.
- Kickoff- and punt-return touchdowns remain distinct return categories and remain excluded from fantasy scoring.

## Safe fallback boundary

The official final stat book is an authoritative fallback for individual forced fumbles and defensive recoveries when its defensive table is available. A player-level fumble-return touchdown is accepted only when a named official scoring-summary touchdown agrees with that player's `FR-Yds` row and the team fumble-return TD total. Ambiguous play-by-play roles remain unsupported.

No historical or test values were written to production Google Sheets.
