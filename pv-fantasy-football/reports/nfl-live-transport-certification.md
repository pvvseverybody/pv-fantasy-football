# PV Fantasy Football — NFL Early Live-behavior Transport Test

Generated: 2026-08-17T05:38:02.869Z

Result: **PREFLIGHT ONLY — NO GAME LIVE**

Endpoint: https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401873286

NFL data is transport evidence only. It was not normalized through SIDEARM and was not written to Google Sheets or fantasy tables.

## Timestamped polling evidence

| Timestamp | Type | Sample | Hash | State | Detail |
|---|---|---:|---|---|---|
| 2026-08-17T05:37:32.443Z | CHANGED_SNAPSHOT | 1 | 556fc01817be417b25199a2ccff36c37a750d5f5dbe1e8daf5a0da28c9d65940 | pre |  |
| 2026-08-17T05:37:47.683Z | UNCHANGED_SUPPRESSED | 2 | 556fc01817be417b25199a2ccff36c37a750d5f5dbe1e8daf5a0da28c9d65940 | pre |  |
| 2026-08-17T05:38:02.868Z | UNCHANGED_SUPPRESSED | 3 | 556fc01817be417b25199a2ccff36c37a750d5f5dbe1e8daf5a0da28c9d65940 | pre |  |

## Observed counts

- CHANGED_SNAPSHOT: 1
- UNCHANGED_SUPPRESSED: 2
- REQUEST_FAILURE: 0
- RECOVERED: 0
- FINAL_VERIFICATION: 0
- POLLING_STOPPED: 0

- Raw changed snapshots preserved: 1
- Poller exit: MAX_SAMPLES

Live transitions, real corrections, live failures/recovery, final verification, and final shutdown remain unobserved until kickoff unless explicitly present above. Synthetic state-machine tests cover those branches but are not live evidence.
