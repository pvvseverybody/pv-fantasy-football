# PV Fantasy Football — SIDEARM Historical Adapter Certification

Generated: 2026-08-17T05:24:54.514Z

Status: **HISTORICAL ADAPTER CERTIFIED WITH BLOCKERS**

No historical payload, fixture, or normalized row was written to Google Sheets or any production table.

## Historical endpoint findings

### Prairie View at Rice — 2025-09-13

- Official endpoint: https://riceowls.com/api/livestats?game_id=28385&detail=full&callback=pvff
- Result: complete=true; Prairie View at Rice; provider date 9/13/2025
- Home roster/normalized/identity issues: 79/41/1
- Visitor roster/normalized/identity issues: 61/39/1

### Mississippi Valley State at Prairie View — 2025-11-22

- Official endpoint: https://pvpanthers.com/api/livestats?game_id=9093&detail=full&callback=pvff
- Result: complete=true; Mississippi Val. at Prairie View; provider date 11/22/2025
- Home roster/normalized/identity issues: 68/39/4
- Visitor roster/normalized/identity issues: 60/35/3

The public `cumestats.ashx` indexes currently return empty arrays, but known SIDEARM game IDs remain retrievable from each official athletics host through `/api/livestats?game_id=...&detail=full` JSONP.

## Verified SIDEARM → GameStats mappings

| SIDEARM field | Normalized field | Status |
|---|---|---|
| Rushing.RushingAttempts | audit.rushingAttempts | VERIFIED |
| Rushing.RushingNetYards | rushYards | VERIFIED |
| Rushing.RushingTouchdowns | rushTouchdowns | VERIFIED |
| Receiving.ReceivingReceptions | receptions | VERIFIED |
| Receiving.ReceivingYards | receivingYards | VERIFIED |
| Receiving.ReceivingTouchdowns | receivingTouchdowns | VERIFIED |
| Passing.PassIntercepted | passingInterceptions | VERIFIED |
| Fumbles.FumblesLost | fumblesLost | VERIFIED |
| Tackling.TotalTackles | tackles | VERIFIED |
| Tackling.UnassistedTacklesForLoss + 0.5 × AssistedTacklesForLoss | tacklesForLoss | VERIFIED_DERIVED |
| Tackling.TacklesForLossYards | tackleForLossYards | VERIFIED |
| Sacks.TotalSacks | sacks | VERIFIED |
| Sacks.SackYardsForLossYards | sackYards | VERIFIED |
| Sacks.HurriedQb | quarterbackHurries | VERIFIED |
| PassDefense.BrokenPass | passBreakups | VERIFIED |
| Interceptions.InterceptionReturnReturns | defensiveInterceptions | VERIFIED |
| Interceptions.InterceptionReturnYards | interceptionReturnYards | VERIFIED |
| — | forcedFumbles | UNSUPPORTED |
| — | fumbleRecoveries | UNSUPPORTED |
| Interceptions.InterceptionReturnTouchdowns | defensiveReturnTouchdowns | VERIFIED_INT_TD_ONLY |
| KickReturns.KickoffReturnTouchdowns | audit.kickReturnTouchdowns | VERIFIED_EXCLUDED |
| PuntReturns.PuntReturnTouchdowns | audit.puntReturnTouchdowns | VERIFIED_EXCLUDED |

TFL is derived as solo TFL plus one-half of assisted TFL. `TotalSacks` is used directly. Interception count/yards/TD come only from the `Interceptions` return group so the overlapping `PassDefense.Interceptions` values are not double-counted. Kickoff- and punt-return touchdowns are retained only as audit fields and are excluded from fantasy defensive touchdowns.

## Unresolved mappings

- forcedFumbles: no safe populated aggregate field was proven. Play-level recovery roles are not used because they occur on non-turnovers and nullified plays.
- fumbleRecoveries: no safe populated aggregate field was proven. Play-level recovery roles are not used because they occur on non-turnovers and nullified plays.

A fumble-return touchdown aggregate was also not proven. `defensiveReturnTouchdowns` is therefore certified only for interception-return touchdowns; another official source is required if a fumble-return touchdown occurs.

## Player identity strategy

1. Match a nonblank SIDEARM `PersonId` within the game roster and then to an explicit provider-ID mapping.
2. If `PersonId` is absent, resolve the stat row to exactly one player using team + jersey + compatible abbreviated name.
3. Resolve that full roster identity to exactly one active PV canonical player using normalized full name + jersey.
4. Zero or multiple matches at either stage are REVIEW/BLOCKED. Jersey alone is never accepted because duplicate numbers exist.

## August 3 staged-date discrepancy

- Staged `Game.Date`: 8/3/2026
- Official scheduled date: 8/27/2026
- Teams: Stony Brook at Delaware State
- NCAA game ID: 40550
- SIDEARM game ID: blank
- Source: statcrew
- Identity validation: BLOCKED — PROVIDER_DATE_MISMATCH

`Game.Date` is supplied inside the current StatCrew-backed `game.json`; it is not derived by PV Fantasy. The most likely explanation is a staged/test StatCrew game header dated August 3. That is an inference, not a confirmed provider statement. PV Fantasy must use the configured official endpoint plus expected teams, scheduled kickoff, and provider event identifier as a composite identity, while continuing to treat the date mismatch as blocking until the feed is corrected or explicitly verified. NCAA game ID alone is insufficient.

## August 27 live-window dependencies

- Confirm the staged payload changes to the official kickoff date/time and retains the expected teams/event identity.
- Observe populated 2026 `PersonId` values and every required stat group.
- Capture 15-second changing snapshots and correction behavior.
- Determine an official fallback for forced fumbles, recoveries, and any fumble-return touchdown.
- Prove final detection, final-book reconciliation, and polling shutdown.

L2 remains **PENDING LIVE EVENT**. This historical certification does not mark L2 PASS.
