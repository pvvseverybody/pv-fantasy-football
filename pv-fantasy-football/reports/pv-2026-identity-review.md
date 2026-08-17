# PV Fantasy Football — 2026 Canonical Identity Review

Source inspected: official Prairie View A&M 2026-27 football roster and production workbook `Players!A1:G150`, read-only.

Status: **PROPOSAL ONLY — DO NOT APPLY WITHOUT ROSTER REVIEW**

## Reconciliation

- Official roster records: 63
- Exact formal-name matches to existing PV Player IDs: 50
- Official roster additions without a PV Player ID: 13
- Existing workbook players absent from the published official roster: 51
- Exact duplicate full names: none
- Duplicate normalized full names after suffix/punctuation normalization: none
- Published jersey values: none; all official roster and current workbook jersey cells are blank, so duplicate jerseys cannot be evaluated
- Stable identifier available: SIDEARM roster-page `rp_id` for all 63 official records
- Live-stat identity caveat: roster `rp_id` has not yet been proven equal to live-feed `PersonId`; keep the namespaces distinct until observed

The proposed row-by-row file is `reports/pv-2026-canonical-identity-proposal.csv`.

## Official additions needing new PV IDs

Jeremy Atkins; Kevin Brown, Jr.; Rondell Carter; Trae Grogan; Nahamani Harris; Isaiah Hill; Leo Lane, Jr.; Damani Maxson; Timothy Potts; Nehemiah Reid; Jamal Streeter, Jr.; Desmonde Thomas, II; Konyae Hunter.

## Current Players absent from the official roster

P001 Jaden Allison; P002 Austine Anyia; P003 Ja'koby Banks; P004 Ray'Quan Bell; P005 Chase Bingmon; P006 Caden Bowers; P007 Ty Brown; P008 Quam Byers; P009 Ellis Bynum; P010 CK Carter; P011 Tevin Carter; P012 Pedro Chagas da Silva; P013 Chaney Fitzgerald; P014 Malik Gucake; P015 Christopher Harvey; P016 Kheagian Heckaman; P017 Jayven Jackson; P018 Skylon Jean-Louis; P019 Ethan John; P020 Travon Jones; P021 Patrick Kendall, III; P022 Molik Mason; P023 Calvin McMillian; P024 Matthew Moore; P025 Xyler Myles; P026 Jahiem O'Hara; P027 Jalen O'Neal; P028 Ashton Ojiaku; P029 Rodny Ojo; P030 Cameron Pascal; P031 Drew Skartvedt; P032 William Taylor; P033 Aiden Webb; P034 David Williams; P035 Xylan Williams; P036 Reginald Wilson; P037 Eric Zachery; P046 Malachi Williams; P089 Elijah Wilson; P090 Treviance "VJ" Bronson; P091 Preston Brown; P092 Micah Bryant; P093 Bryce Dixon; P094 Isaiah Gordon; P095 Tre Leonard; P096 Hanziah Rana; P097 Darien Rogers; P098 Anthony Shareef Irons; P099 Ethan Eddins; P100 Kaeden Smith; P101 Bruce Uperesa.

Absence is a review flag, not proof that a player should be deleted or deactivated.

## Position review

- Likely compatible position-family refinements: Jordan Campbell DL→DE; Kamrin Canterbury DB→SAF; Gabriel Ikechukwu DL→DT; Fitzroy Ledgister DB→CB; Harrison McKinley DB→SAF; Marley Minerds K/P→P; Kerry North DL→DT; Elias Sanders DL→DE; Demarcus Wynn DL→DT.
- Manual eligibility review required: Dorian Gates DL→WILL; Nicholas Tramble WR→RB; Jace Ward LB→ATH; Jacob Hansen LB→NK.

No fantasy eligibility change is made by this proposal.

## Names and ambiguity

- Suffixes requiring exact preservation: William Blaylock, II; Kevin Brown, Jr.; Toric Goins, Jr.; Jamie Johnson, Jr.; Leo Lane, Jr.; Mark Rayson, III; Jamal Streeter, Jr.; Desmonde Thomas, II; Cedric Thornton, Jr.
- Punctuation-sensitive names include Ky'Yon Harris and the hyphenated Turner-Knox and Jean-Louis identities.
- Repeated surnames include Harris and Davis; they must never resolve from surname alone.
- No authoritative jersey data currently exists to disambiguate same-name or same-surname cases.

## Production resolver priority

1. Exact, namespace-qualified live provider person ID already bound to one PV Player ID.
2. Exact, namespace-qualified official roster `rp_id` only after its relationship to the live feed is proven.
3. Team + nonblank jersey + compatible normalized formal name, requiring exactly one provider and one canonical candidate.
4. Otherwise fail closed into IdentityReview; never use blank jersey, surname-only, fuzzy-only, or first-match resolution.
