# PV vs Everybody — W0 Tarleton launch and game-day runbook

This runbook is for a non-developer. Use the protected Game-day Operations page. Do not edit score tables or publish because a game merely looks final.

## PRE-LAUNCH

**You should see:** System Readiness is at least READY FOR BETA; configuration and workbook schema are configured/compatible; Season Launch Preflight has no BLOCKED diagnostics; W0 Tarleton is the only OPEN game; W1 and later are PENDING; publication is HOLD.

**Do:** verify the protected admin login and `/api/admin/system-readiness`; confirm the official schedule, final approved roster status, participant registration/email delivery, eight-slot eligibility, provider event identity, and service-account read access. Complete the approved staging beta journey and verify raw plus authoritative lineup records. Keep publication on HOLD.

**If not:** stop. Wrong opponent, kickoff, event ID, or roster identity must be corrected and rechecked before accepting entries. If admin is unavailable, verify server environment and service-account access.

## 60 minutes before kickoff

**You should see:** the intended game selected; lineup OPEN; feed healthy/idle or beginning pregame snapshots; recent successful pipeline/feed activity; no identity ambiguity or game identity mismatch.

**Do:** start or verify the approved read-only/live feed runner, confirm timestamp movement, and keep the official provider page available as an independent reference. Announce the exact lineup deadline to participants.

**If not:** if feed is stale/unavailable, follow retry/recovery and preserve the last good snapshot. If game identity mismatches, stop ingestion immediately. Do not switch providers or event IDs without verified evidence.

## At lineup lock

**You should see:** lineup status LOCKED at kickoff; accepted lineup count stable; rejected/late count may increase; each accepted participant has exactly one scoring version and eight picks.

**Do:** confirm new submissions are rejected and pre-kickoff accepted lineups remain unchanged. Record the accepted-lineup count.

**If not:** do not manually alter picks. Use the authoritative submission/version records to determine the latest accepted pre-kickoff version. Any participant with fewer or more than eight scoring picks is blocked from scoring until repaired and reconciled.

## GAME DAY — during play

**You should see:** LIVE game state; fresh snapshots at the certified interval; feed healthy; ingestion times advancing; normalized player count growing/stable; provisional scoring only; publication HOLD.

**Do:** watch snapshot time, feed health, unmatched identities, missing stats, duplicate stats, and score reconciliation. Treat corrections/reductions as expected evidence when captured, not as a reason to add points manually.

**If not:** stale feed/provider unavailable → retain the last good snapshot and allow certified retries. Identity ambiguity or game mismatch → stop scoring for affected data and resolve against official evidence. Missing/duplicate stats or score mismatch → keep publication blocked.

## POSTGAME — apparent final

**You should see:** provider final observed repeatedly; feed runner performs continued verification; official final is still NOT VERIFIED until the official artifact is available; publication HOLD.

**Do:** wait for the required consecutive final observations and clean runner shutdown. Obtain the official final box score/stat book. Preserve final raw evidence.

**If not:** if the provider returns to live or numbers change, resume verification and treat the earlier final as false/apparent. Never publish from a single final signal.

## POSTGAME — before publishing final scores

**You should see:** official final VERIFIED; no unmatched/ambiguous players; complete normalized stats including required defensive fallback; exactly eight accepted scoring picks per participant; player, lineup, weekly, and leaderboard totals reconciled; reconciliation PASS and READY_TO_LOCK; no active blocker.

**Do:** compare provider totals to the official artifact, resolve every discrepancy, run scoring once more idempotently, and verify public labels still say FINAL • VERIFYING STATS. Only the authorized operator may change the existing publication control after every check passes.

**If not:** follow the recommended action shown beside each diagnostic. Missing FF/FR/fumble-return evidence, reconciliation differences, lineup-count mismatch, score mismatch, or unverified official final always means HOLD.

## After publication

**You should see:** readiness READY; publication released; public label FINAL • OFFICIAL; personal eight-player sums match weekly scores; weekly and season leaderboard ordering is correct.

**Do:** spot-check at least two participants, including a shared player if present. Save the certification/reconciliation evidence and record publication time. Keep raw snapshots and audit tables unchanged.

**If not:** freeze/return publication to HOLD through the existing authorized control process, preserve evidence, and investigate. Do not patch public scores directly or create a second source of truth.

## EMERGENCY HOLD

Publication must remain frozen for any unavailable workbook/control state, failed schema check, game/event identity mismatch, stale or unavailable feed without certified recovery, unresolved player identity, missing or duplicate normalized stats, unavailable authoritative FF/FR/fumble-return evidence, anything other than exactly eight unique scoring picks, superseded/rejected/late lineup leakage, player/lineup/weekly total mismatch, failed WriterGate/ScoringGate/ScoringE2E/invariant, unverified official final, reconciliation discrepancy, or publication control that is not explicitly approved. Preserve evidence, stop the affected pipeline action, and follow the diagnostic’s recommended action; never repair public totals directly.

## Incident playbook

| Incident | Automatic system behavior | Operator check | Continue or freeze |
|---|---|---|---|
| Feed goes down | Retain last evidence, retry, report provider unavailable/stale | Official provider, network, timestamps, recovery evidence | Entry may continue before lock; freeze ingestion/scoring/publication |
| Wrong game detected | Block on identity mismatch | Event ID, teams, kickoff, authoritative Games row | Freeze ingestion/scoring/publication |
| Player cannot be mapped | Quarantine the identity and block dependent scoring | Official roster, stable provider ID, jersey/name evidence | Freeze affected scoring and publication |
| Stats change after final | Preserve correction and remove final readiness | Official final artifact and corrected snapshot | Freeze publication or return it to HOLD |
| Defensive data missing | Report defensive fallback pending | Official FF/FR/fumble-return attribution | Freeze final publication |
| Scoring total does not reconcile | Report scoring/lineup mismatch | Eight accepted picks, PlayerScores, lineup and weekly sums | Freeze publication |
| Google Sheets unavailable | Fail APIs/readiness closed without writing | Credentials, sharing, workbook availability, schema | Freeze entry writes, scoring, and publication |
| Resend unavailable | Return authentication unavailable; create no authenticated session | Sender verification, Resend status, server configuration | Existing sessions may read; freeze new registration/login-dependent entry |
| Participant cannot log in | Keep identity unverified and lineup writes unauthorized | Generic response, inbox delivery, expiry, throttling; never inspect or reveal codes | Do not bypass authentication |
| Accidental publication attempt | Readiness remains HOLD/BLOCKED unless every gate passes | Official final, fallback, reconciliation, invariants, explicit control | Freeze publication immediately |
