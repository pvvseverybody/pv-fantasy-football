# PV vs Everybody — Game-day operator runbook

This runbook is for a non-developer. Use the protected Game-day Operations page. Do not edit score tables or publish because a game merely looks final.

## Before game day

**You should see:** the correct opponent and kickoff; lineup status OPEN only for the intended game; feed configured but not live; scoring not calculated; publication HOLD.

**Do:** confirm the official schedule, roster, participant list, eight-slot eligibility, provider event identity, and admin login. Submit one approved staging/launch-tester lineup and verify its confirmation. Keep publication on HOLD.

**If not:** stop. Wrong opponent, kickoff, event ID, or roster identity must be corrected and rechecked before accepting entries. If admin is unavailable, verify server environment and service-account access.

## 60 minutes before kickoff

**You should see:** the intended game selected; lineup OPEN; feed healthy/idle or beginning pregame snapshots; recent successful pipeline/feed activity; no identity ambiguity or game identity mismatch.

**Do:** start or verify the approved read-only/live feed runner, confirm timestamp movement, and keep the official provider page available as an independent reference. Announce the exact lineup deadline to participants.

**If not:** if feed is stale/unavailable, follow retry/recovery and preserve the last good snapshot. If game identity mismatches, stop ingestion immediately. Do not switch providers or event IDs without verified evidence.

## At lineup lock

**You should see:** lineup status LOCKED at kickoff; accepted lineup count stable; rejected/late count may increase; each accepted participant has exactly one scoring version and eight picks.

**Do:** confirm new submissions are rejected and pre-kickoff accepted lineups remain unchanged. Record the accepted-lineup count.

**If not:** do not manually alter picks. Use the authoritative submission/version records to determine the latest accepted pre-kickoff version. Any participant with fewer or more than eight scoring picks is blocked from scoring until repaired and reconciled.

## During game

**You should see:** LIVE game state; fresh snapshots at the certified interval; feed healthy; ingestion times advancing; normalized player count growing/stable; provisional scoring only; publication HOLD.

**Do:** watch snapshot time, feed health, unmatched identities, missing stats, duplicate stats, and score reconciliation. Treat corrections/reductions as expected evidence when captured, not as a reason to add points manually.

**If not:** stale feed/provider unavailable → retain the last good snapshot and allow certified retries. Identity ambiguity or game mismatch → stop scoring for affected data and resolve against official evidence. Missing/duplicate stats or score mismatch → keep publication blocked.

## At apparent final

**You should see:** provider final observed repeatedly; feed runner performs continued verification; official final is still NOT VERIFIED until the official artifact is available; publication HOLD.

**Do:** wait for the required consecutive final observations and clean runner shutdown. Obtain the official final box score/stat book. Preserve final raw evidence.

**If not:** if the provider returns to live or numbers change, resume verification and treat the earlier final as false/apparent. Never publish from a single final signal.

## Before publishing final scores

**You should see:** official final VERIFIED; no unmatched/ambiguous players; complete normalized stats including required defensive fallback; exactly eight accepted scoring picks per participant; player, lineup, weekly, and leaderboard totals reconciled; reconciliation PASS and READY_TO_LOCK; no active blocker.

**Do:** compare provider totals to the official artifact, resolve every discrepancy, run scoring once more idempotently, and verify public labels still say FINAL • VERIFYING STATS. Only the authorized operator may change the existing publication control after every check passes.

**If not:** follow the recommended action shown beside each diagnostic. Missing FF/FR/fumble-return evidence, reconciliation differences, lineup-count mismatch, score mismatch, or unverified official final always means HOLD.

## After publication

**You should see:** readiness READY; publication released; public label FINAL • OFFICIAL; personal eight-player sums match weekly scores; weekly and season leaderboard ordering is correct.

**Do:** spot-check at least two participants, including a shared player if present. Save the certification/reconciliation evidence and record publication time. Keep raw snapshots and audit tables unchanged.

**If not:** freeze/return publication to HOLD through the existing authorized control process, preserve evidence, and investigate. Do not patch public scores directly or create a second source of truth.
