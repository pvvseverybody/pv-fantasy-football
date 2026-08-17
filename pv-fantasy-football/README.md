# PV Fantasy Football
Production web shell for PV Fantasy Football 2026.

## Vercel
This repo is intended to be connected to the existing `pv-fantasy-football` Vercel project. Pushing to the production branch triggers deployment.

## Current state
The player pool, game hub, lineup submission, authoritative lineup promotion, and scoring APIs use the production Google Sheet. Lineups are validated server-side, persisted to the raw submission ledger, and promoted through the workbook's authoritative versioned model. The scoring pipeline calculates auditable individual player scores and verifies their propagation into accepted lineups, weekly scores, and the leaderboard. No demo player or score data is presented as real.

## Google Sheets configuration

The server requires these environment variables:

- `BACKEND_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `LINEUP_SUBMISSIONS_SHEET` (optional; defaults to `Lineup Submissions`)

Share the spreadsheet with the service account as an editor. The submissions sheet must have these exact headers in cells A3:L3:

`Submission ID`, `Submitted At`, `Email`, `Game ID`, `RB`, `WR`, `TE`, `Offensive Flex`, `DL`, `LB`, `DB`, `Defensive Flex`

Each validated web request is appended to `Lineup Submissions` as a raw durable ledger row. `Submission ID` is a deterministic hash of the normalized email, game, and eight picks, so exact retries do not append another raw row.

After the raw write succeeds, the server resolves an existing active, verified participant by normalized primary email and promotes the submission through the workbook's authoritative model in one Sheets batch transaction:

- append one immutable `SubmissionHistory` version;
- append exactly eight versioned `Picks` rows;
- demote the prior scoring version, if any;
- upsert the rebuildable `Lineups` projection;
- upsert `ActiveLineups` to the newly accepted version.

The API reports acceptance only after post-write invariant checks pass. The current web request has no participant display-name field, so unknown emails are not auto-created; they fail the writer identity gate instead.

## Scoring pipeline

`POST /api/scoring` runs the server-side scoring pipeline for one `game_id`. It requires `Authorization: Bearer <SCORING_PIPELINE_SECRET>` and never accepts statistics in the request body. The pipeline reads normalized, source-attributed rows from `GameStats`, calculates each auditable component and total, and writes the corresponding `PlayerScores` rows atomically. Existing workbook formulas propagate those scores only through valid accepted scoring-version picks and lineups into `WeeklyScores` and `Leaderboard`.

The pipeline fails closed when normalized fields are blank/non-numeric, a game/player row is duplicated, provenance is missing, or an accepted lineup player has no normalized stat line. Live rows may calculate provisionally, but the pipeline does not change reconciliation, official-final, or publication controls.

Negative-yard scoring follows the existing adapter contract: `TFL Yds + INT Return Yds`. `Sack Yds` is preserved in `GameStats` for audit but is not added again because official TFL yards already include sack yards. QBH and PBU are scored as separate one-point categories. Kick- and punt-return touchdowns are excluded.

## Preseason certification

Run `npm run certify:preseason` to execute the isolated end-to-end certification harness and regenerate `reports/preseason-certification.md`. The harness uses only in-memory fixture tables; it never calls Google Sheets or the production scoring endpoint.

It covers two participants across two games, a shared player, a pre-kickoff lineup replacement, a rejected late submission, scoring and reconciliation, cumulative ordering, idempotent reruns, excluded return touchdowns, and fail-closed behavior for a missing normalized player row. A passing local report is a preseason logic certificate only; the workbook's PVFeedCertification L2/L3 and PublishControl gates remain required for a live Prairie View game.

## L2 live-provider certification

Run `npm run certify:l2-transport` to perform the read-only L2 preflight against the official Stony Brook at Delaware State SIDEARM feed and regenerate `reports/l2-transport-certification.md`. The harness validates endpoint allowlisting, HTTP/JSON transport, CORS, cache validators, event identity, football schema groups, and pregame state without writing to the workbook.

Preflight readiness is not a full L2 pass. During the August 27 live window, L2 must still capture changing 15-second snapshots, corrections, final-state detection, official-stat reconciliation, and proof that polling stops after final.

Run `npm run certify:sidearm-history` to inspect the allowlisted official historical SIDEARM JSONP events, validate the provider-to-GameStats adapter in memory, recheck the staged event identity/date, and regenerate `reports/sidearm-historical-adapter-certification.md`. The live summary still lacks proven FF/FR/fumble-return-TD fields. Final-stat-book fallback values are accepted only when explicitly final, player-attributed, source-linked, and reconciled; otherwise publication remains blocked.

`npm run certify:nfl-preflight` performs the short separate ESPN/NFL transport preflight. `npm run certify:nfl-live` is the unattended August 20 runner: it waits until 30 minutes before kickoff, polls every 15 seconds, appends raw changed snapshots and event evidence, resumes from preserved raw evidence after interruption, requires three consecutive final observations, and has duration/failure limits. NFL payloads are never normalized through the SIDEARM adapter or written to Sheets.

`npm run certify:l3-rice` runs the read-only 2025 Prairie View at Rice identity, normalization, official-book reconciliation, and fantasy-score dry run. The 2026 identity review artifacts are `reports/pv-2026-canonical-identity-proposal.csv` and `reports/pv-2026-identity-review.md`; they are proposals only and do not update `Players`.

`npm run certify:pv-roster` retrieves the current official PV roster and compares it with the captured fall-camp baseline, the production `Players` registry (live read-only when credentials are present, otherwise the labeled captured production snapshot), and prior provider mapping proposals. It preserves timestamped raw roster evidence and regenerates a manual-approval migration proposal. During fall camp the result is always classified `PROVISIONAL_FALL_CAMP`; missing jerseys are expected, and no player is automatically created, changed, deactivated, or assigned a reused PV ID.
