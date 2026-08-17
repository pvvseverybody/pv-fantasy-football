# PV Fantasy Football — Historical Prairie View L3 Dry Run

Generated: 2026-08-17T05:41:05.068Z

Status: **DRY RUN RECONCILED — NOT FULL L3 PASS**

Source: https://riceowls.com/api/livestats?game_id=28385&detail=full&callback=pvff
Event: Prairie View at Rice, 9/13/2025, complete=true

No historical GameStats or PlayerScores were written to the production workbook.

## Identity mapping

- Successfully mapped to current canonical Players: 26
- Historical roster identities not present in current canonical Players: 35
- Provider stat-row identity issues: 0

The provider stat-row join uses provider person ID first, then team + jersey + compatible name with ambiguity failure. The final provider-to-current-PV join is exact unique normalized full name because the inspected 2026 Players rows do not currently contain jersey values. Historical jerseys below are provider evidence, not invented workbook values.

### Successfully mapped

- P003: Ja'koby Banks (#1)
- P019: Ethan John (#5)
- P014: Malik Gucake (#6)
- P020: Travon Jones (#8)
- P029: Rodny Ojo (#9)
- P037: Eric Zachery (#12)
- P005: Chase Bingmon (#20)
- P011: Tevin Carter (#21)
- P028: Ashton Ojiaku (#22)
- P016: Kheagian Heckaman (#33)
- P018: Skylon Jean-Louis (#37)
- P024: Matthew Moore (#39)
- P031: Drew Skartvedt (#41)
- P017: Jayven Jackson (#45)
- P089: Elijah Wilson (#46)
- P033: Aiden Webb (#47)
- P030: Cameron Pascal (#57)
- P023: Calvin McMillian (#66)
- P004: Ray'Quan Bell (#67)
- P010: CK Carter (#71)
- P012: Pedro Chagas da Silva (#73)
- P025: Xyler Myles (#76)
- P013: Chaney Fitzgerald (#87)
- P032: William Taylor (#88)
- P022: Molik Mason (#92)
- P026: Jahiem O'Hara (#98)

### Unmatched historical roster

- Sterling Roberts (#3)
- Travor Randle (#4)
- Cameron Peters (#4)
- Kennedy Parker (#7)
- Andre Dennis (#10)
- Jyzaiah Rockwell (#11)
- Joseph Alcala (#13)
- Kellen Stewart (#14)
- Shadrick Byrd (#15)
- Tyler Nelson (#18)
- Lamagea McDowell (#23)
- Kamren Amao (#23)
- Darrell Starling (#25)
- Brandon Campbell (#26)
- Jaylon Shelton (#27)
- Trinity Ward (#35)
- Benjamin Stewart (#36)
- Josh Williamson (#40)
- Mandel Eugene Jr. (#42)
- Nick Haynes (#43)
- Adam Atwell (#48)
- Premiere Whitley (#55)
- Jeremiah Mawali (#75)
- Kerya Powell (#81)
- Jeremiah Aaron (#82)
- Cameron Bonner (#83)
- Diego Alfaro (#86)
- DeAlo McGee (#90)
- Jabarrek Hopkins (#91)
- Jamal Marshall (#93)
- Tiago Sumbo (#94)
- III,James Kate (#95)
- Carlos Villagomez (#97)
- Alajujuan Sparks Jr. (#99)
- TEAM (#TM)

## Fantasy scores for every mapped canonical player

| Player ID | Player | Fantasy score |
|---|---|---:|
| P003 | Ja'koby Banks | 0.0 |
| P019 | Ethan John | 0.0 |
| P014 | Malik Gucake | 3.4 |
| P020 | Travon Jones | 7.7 |
| P029 | Rodny Ojo | 0.0 |
| P037 | Eric Zachery | 6.5 |
| P005 | Chase Bingmon | 2.5 |
| P011 | Tevin Carter | 12.5 |
| P028 | Ashton Ojiaku | 1.5 |
| P016 | Kheagian Heckaman | 0.0 |
| P018 | Skylon Jean-Louis | 1.0 |
| P024 | Matthew Moore | 1.0 |
| P031 | Drew Skartvedt | 0.0 |
| P017 | Jayven Jackson | 7.8 |
| P089 | Elijah Wilson | 0.0 |
| P033 | Aiden Webb | 0.0 |
| P030 | Cameron Pascal | 0.0 |
| P023 | Calvin McMillian | 0.0 |
| P004 | Ray'Quan Bell | 0.0 |
| P010 | CK Carter | 0.0 |
| P012 | Pedro Chagas da Silva | 0.0 |
| P025 | Xyler Myles | 0.0 |
| P013 | Chaney Fitzgerald | 0.0 |
| P032 | William Taylor | 1.5 |
| P022 | Molik Mason | 2.0 |
| P026 | Jahiem O'Hara | 0.0 |

## Provider → official Rice final-book reconciliation

| Statistic | Provider/fallback | Official | Result |
|---|---:|---:|---|
| rushYards | 100 | 100 | PASS |
| rushTouchdowns | 1 | 1 | PASS |
| receptions | 13 | 13 | PASS |
| receivingYards | 151 | 151 | PASS |
| receivingTouchdowns | 1 | 1 | PASS |
| passingInterceptions | 0 | 0 | PASS |
| fumblesLost | 0 | 0 | PASS |
| tackles | 92 | 92 | PASS |
| tacklesForLoss | 9 | 9 | PASS |
| tackleForLossYards | 22 | 22 | PASS |
| sacks | 1 | 1 | PASS |
| sackYards | 5 | 5 | PASS |
| quarterbackHurries | 2 | 2 | PASS |
| passBreakups | 4 | 4 | PASS |
| defensiveInterceptions | 0 | 0 | PASS |
| interceptionReturnYards | 0 | 0 | PASS |
| forcedFumbles | 1 | 1 | PASS |
| fumbleRecoveries | 0 | 0 | PASS |
| defensiveReturnTouchdowns | 0 | 0 | PASS |

Forced fumbles and recoveries for this game use the official final stat-book defensive table: Eric Zachery has one FF; PV has zero defensive recoveries. The official team return line reports zero fumble-return touchdowns. These values are local dry-run fallback evidence, not SIDEARM summary mappings.

## Remaining blockers

- Historical roster does not fully exist in the current 2026 canonical Players table.
- Current 2026 canonical Players rows have blank jersey values; exact unique normalized name is therefore the final canonical join in this dry run.
- SIDEARM summary still lacks aggregate forced-fumble and defensive-recovery fields.
- A nonzero player-attributed fumble-return touchdown fallback remains unproven.
- Live PV transport, corrections, final detection, and publication controls remain uncertified.

This result must not be called a full L3 PASS.
