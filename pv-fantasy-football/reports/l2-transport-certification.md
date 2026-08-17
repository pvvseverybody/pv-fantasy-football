# PV Fantasy Football — L2 Live-provider Transport Certification

Generated: 2026-08-17T05:00:25.966Z

Status: **READY FOR LIVE WINDOW**

Full L2 result: **PENDING LIVE EVENT**

This is a read-only preflight against the official public provider. It did not write to Google Sheets, GameStats, or any authoritative production table.

## Discovered transport

- Endpoint: https://sidearmstats.com/delawarestate/football/game.json?detail=full
- Content type: application/json; charset=utf-8
- CORS: *
- ETag: 18ADD6B5263D98FCF67C6C86E9C68798EBCF1FFEE3889111768E70D7F5CBA46D
- SHA-256 snapshot hash: deb461b920e6b76c4023d79f8e1a62747a6d7accec572b0fd5432afaea2e0333
- Event: Stony Brook at Delaware State
- Provider source: statcrew
- NCAA game ID: 40550
- State: started=false; complete=false
- Players/plays currently populated: 0/0

## Preflight checks

| Check | Result | Evidence |
|---|---|---|
| Official structured endpoint responds with JSON | PASS | application/json; charset=utf-8 |
| Cross-origin server reads are supported | PASS | * |
| Snapshot supplies a cache validator | PASS | 18ADD6B5263D98FCF67C6C86E9C68798EBCF1FFEE3889111768E70D7F5CBA46D |
| Payload is a football game | PASS | FootballGame |
| L2 opponent identity matches | PASS | Stony Brook at Delaware State |
| Required football stat groups are present | PASS | 20/20 |
| Pregame state is not treated as final | PASS | started=false; complete=false |

## Required during the live window

- Changing live snapshots at the 15-second cadence
- Correction/replacement behavior
- Final-state detection
- Official final-stat reconciliation
- Polling shutdown after final

A preflight PASS must not be promoted to full L2 PASS until every live-window item above has direct evidence.
