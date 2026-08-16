# PV Fantasy Football 1.0 — Preseason Certification

Overall result: **PASS**

Scope: isolated fixtures only. No production workbook tables or live scoring endpoints were used.

Certified path: normalized source stats → GameStats → PlayerScores → accepted scoring-version Picks → Lineups → ActiveLineups → WeeklyScores → Leaderboard.

## Player score reconciliation

| Game | Player | Expected | Actual | Result |
|---|---:|---:|---:|---|
| CERT-W1 | P1 | 22.0 | 22.0 | PASS |
| CERT-W1 | P2 | -4.0 | -4.0 | PASS |
| CERT-W1 | P3 | 18.0 | 18.0 | PASS |
| CERT-W1 | P4 | 1.0 | 1.0 | PASS |
| CERT-W1 | P5 | 12.2 | 12.2 | PASS |
| CERT-W1 | P6 | 13.5 | 13.5 | PASS |
| CERT-W1 | P7 | 0.0 | 0.0 | PASS |
| CERT-W1 | P8 | 5.0 | 5.0 | PASS |
| CERT-W1 | P9 | 3.0 | 3.0 | PASS |
| CERT-W1 | P10 | 16.0 | 16.0 | PASS |
| CERT-W1 | P11 | 7.5 | 7.5 | PASS |
| CERT-W1 | P12 | 6.4 | 6.4 | PASS |
| CERT-W1 | P13 | 11.0 | 11.0 | PASS |
| CERT-W1 | P14 | 3.0 | 3.0 | PASS |
| CERT-W1 | P15 | 2.0 | 2.0 | PASS |
| CERT-W2 | P1 | 10.0 | 10.0 | PASS |
| CERT-W2 | P2 | 12.0 | 12.0 | PASS |
| CERT-W2 | P3 | 12.0 | 12.0 | PASS |
| CERT-W2 | P4 | 4.0 | 4.0 | PASS |
| CERT-W2 | P5 | 6.5 | 6.5 | PASS |
| CERT-W2 | P6 | 4.0 | 4.0 | PASS |
| CERT-W2 | P7 | 6.0 | 6.0 | PASS |
| CERT-W2 | P8 | 1.0 | 1.0 | PASS |
| CERT-W2 | P9 | 2.0 | 2.0 | PASS |
| CERT-W2 | P10 | 1.0 | 1.0 | PASS |
| CERT-W2 | P11 | 0.5 | 0.5 | PASS |
| CERT-W2 | P12 | 1.0 | 1.0 | PASS |
| CERT-W2 | P13 | 0.5 | 0.5 | PASS |
| CERT-W2 | P14 | 0.0 | 0.0 | PASS |
| CERT-W2 | P15 | 0.0 | 0.0 | PASS |

## Participant weekly scores

| Game | Participant | Expected | Actual | Result |
|---|---|---:|---:|---|
| CERT-W1 | CERT-A | 65.7 | 65.7 | PASS |
| CERT-W1 | CERT-B | 72.9 | 72.9 | PASS |
| CERT-W2 | CERT-A | 56.5 | 56.5 | PASS |
| CERT-W2 | CERT-B | 14.0 | 14.0 | PASS |

## Cumulative leaderboard

| Rank | Expected participant | Actual participant | Expected total | Actual total | Result |
|---:|---|---|---:|---:|---|
| 1 | CERT-A | CERT-A | 122.2 | 122.2 | PASS |
| 2 | CERT-B | CERT-B | 86.9 | 86.9 | PASS |

## Eight-pick reconciliation

| Game | Participant | Accepted submission | Picks | Pick sum | Lineup | Weekly | Result |
|---|---|---|---:|---:|---:|---:|---|
| CERT-W1 | CERT-A | SUB-A-W1-V2 | 8 | 65.7 | 65.7 | 65.7 | PASS |
| CERT-W1 | CERT-B | SUB-B-W1-V1 | 8 | 72.9 | 72.9 | 72.9 | PASS |
| CERT-W2 | CERT-A | SUB-A-W2-V1 | 8 | 56.5 | 56.5 | 56.5 | PASS |
| CERT-W2 | CERT-B | SUB-B-W2-V1 | 8 | 14.0 | 14.0 | 14.0 | PASS |

## Invariant and gate checks

| Check | Detail | Result |
|---|---|---|
| Shared player score reused by both participants | 2 active P1 picks at 22 points | PASS |
| Newest accepted Alpha lineup is active | active=SUB-A-W1-V2; prior=SUPERSEDED | PASS |
| Late submission never scores | state=REJECTED_LATE; picks=0 | PASS |
| Kick/punt return TD excluded end-to-end | P7 total=0 | PASS |
| Reconciliation matches eight picks to lineup and weekly totals | 4/4 participant-games reconciled | PASS |
| Rerun is idempotent | records unchanged after second ingestion/submission/scoring run | PASS |
| Missing normalized player row blocks scoring and publication | MISSING_PLAYER_STAT_LINE; scores=0; publish=HOLD | PASS |
| Raw fixture provenance and excluded return stats preserved | raw kick/punt return TD values retained for audit | PASS |
| All fixture games reconciled before publication | isolated fixture reconciliation PASS; isolated publish gates PUBLISH | PASS |

## Remaining live-certification boundary

- This report satisfies an isolated preseason logic certification comparable to the workbook’s ScoringE2E and invariant checks.
- It does not replace PVFeedCertification L2/L3, a live provider transport test, final-book reconciliation, or commissioner-controlled PublishControl.
- A real PV game still requires provider discovery, changing snapshot polling, correction handling, final detection, official reconciliation, and polling shutdown proof.
