# PV Fantasy Football 1.0 — beta acceptance package

Tester: __________  Device: __________  Browser: __________  Date: __________  Result: PASS / FAIL  Notes/evidence: __________

Use only the isolated staging deployment and an approved test identity. Never use production participant data.

- [ ] Create an account and receive the verification email.
- [ ] Enter the verification code and reach the lineup flow.
- [ ] Log out, return, and sign in again as a returning participant.
- [ ] Build all eight eligible slots and review the complete lineup.
- [ ] Submit and see authoritative acceptance, timestamp, matchup, and all eight players.
- [ ] Close/reload the browser and confirm the accepted lineup is restored without exposing internal IDs.
- [ ] Replace one player before lock; confirm the newest lineup supersedes the earlier one.
- [ ] Retry the identical lineup; confirm it is already saved and no duplicate is created.
- [ ] Confirm a locked/late lineup cannot be submitted or replaced.
- [ ] Confirm picks/results are withheld when required, live points say provisional, final HOLD is explicit, and published results say official.
- [ ] Confirm weekly and season leaderboard states are understandable, including no-score state.
- [ ] Open Rules and verify the eight-position/scoring explanations.
- [ ] Check common failures: authentication unavailable, invalid/expired code, backend unavailable, schedule unavailable, no eligible players, and results unavailable.
- [ ] On phone, confirm no horizontal overflow, clipped buttons, unreadable cards, or hidden navigation.
- [ ] On desktop, complete the same flow using keyboard only and visible focus states.
- [ ] Confirm logout invalidates the session; confirm an expired session requires a new login.

Administrator review after each tester: registration/session rows valid; no duplicate identity; raw submission idempotent; exactly one active scoring version; exactly eight picks; no production workbook activity; no private data in screenshots/evidence.
