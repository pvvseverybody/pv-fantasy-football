# PV Fantasy Football — Production-readiness Checklist

## Already certified

- Durable raw lineup submission and authoritative version promotion.
- Accepted scoring-version lineup selection and eight-player reconciliation.
- Fantasy scoring rules, audit components, missing-stat fail-closed behavior, and excluded kick/punt-return TDs.
- Historical SIDEARM summary field mapping and Rice historical reconciliation.
- Snapshot hashing, unchanged suppression, correction detection, retry/recovery, false-final handling, and consecutive-final state-machine behavior in automated tests.

## Ready but awaiting live observation

- August 20 NFL transport-only live window using the unattended runner.
- Actual request outages/recovery, numeric corrections, live transitions, three consecutive finals, and automatic final shutdown.
- August 29 Prairie View at Tarleton State live-provider behavior and official-final publication gates. The earlier SIDEARM transport certificate remains separate and must not be assumed to certify Tarleton's production provider.
- PV roster status is **PROVISIONAL_FALL_CAMP**. The reusable read-only reconciliation is ready, but finalized registry migration waits for a later, more complete official roster publication.

## Requires workbook/configuration change

- Run `npm run certify:pv-roster` after each material official roster update and review the generated migration proposal.
- Assign permanent PV IDs only to final-roster `NEW_PV_ID_REQUIRED` rows after manual approval.
- Do not deactivate existing players based on the provisional fall-camp roster; inactive proposals require later final-roster reconciliation and manual approval.
- Add explicit identity columns or a dedicated mapping table for provider namespace, provider ID, source URL, observed date, and verification status.
- Populate jerseys only after Prairie View publishes authoritative values. Missing jerseys are expected in `PROVISIONAL_FALL_CAMP`, not defects.
- Review four material position differences before changing fantasy eligibility.
- Configure an external supervisor/task host to start and retain the August 20 unattended process; local code alone cannot survive a powered-off or sleeping machine.
- Correct the current `FeedControl`/`Reconciliation` game-opponent drift against authoritative `Games` before enabling any production runner.
- Provision approved real participants and remove/deactivate the demo-only participant before public entry opens.

## Unresolved blocker

- Roster-page `rp_id` has not been proven to equal the live SIDEARM `PersonId`.
- Live/provisional SIDEARM summary payloads still do not provide proven FF, FR, or fumble-return-TD player fields.
- Final publication must wait for a reconciled official final-stat-book fallback when those fields are absent live.
- Registered email alone does not prove control of a participant identity for lineup writes; an approved authenticated participant-session method is required for launch.

## Nice-to-have / non-blocking

- Persist a machine-readable run manifest with host/process metadata.
- Add alerting when the unattended runner exits for duration or failure safeguards rather than verified final.
- Automate official final-stat-book extraction after a second modern nonzero fumble-return-TD example confirms layout consistency.
