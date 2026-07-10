# Curriculum Rules Reference

This document is a snapshot of every curriculum rule currently encoded in the studyplanner app's
data files (`shared/data/majors/*.json`, `shared/data/minors/*.json`,
`shared/data/second-majors/*.json`) and logic (`src/lib/studyPlan.ts`,
`src/components/SemesterGrid.tsx`), generated for faculty/senior verification.

**This is NOT an official NUS source.** It reflects what the app happens to implement today (data
tagged `AY2026/2027` for majors). MC targets, module lists, and requirement structures should be
cross-checked against the student's own degree audit / official NUS curriculum pages, since NUS
revises curricula yearly and this app's data can lag or contain transcription errors.

---

## 1. General NUS / NUSC / NOC rules

These are university-wide and NUS-College-wide rules that apply across all majors, sourced from
NUSC official PDFs (AY2022–24 and AY2025/26+ cohorts) and NUSC FAQs (updated 9 Apr 2026), fetched
2026-07-10. Figures marked "per NUSC official PDFs" below are cited from that reference material,
not re-derived from app code.

### Year 1 Semester 1 course-load cap

- **Enforced in code:** `src/components/SemesterGrid.tsx`, constant `YEAR_ONE_MAX_MCS = 26` (line 17).
- Applied in two places:
  - `canPlaceModule()` (line 566-567) blocks moving/adding a module into Y1S1 if the semester's
    projected MC total would exceed 26.
  - `getLoadWarning()` (line 569-576) flags a semester as over cap ("Y1S1 cap exceeded") only when
    `year === 1 && sem === 1 && totalMcs > 26`.
- **The cap applies ONLY to Year 1 Semester 1.** Year 1 Semester 2 and all later semesters use the
  general load-warning thresholds instead: `UNDERLOAD_MCS = 16` and `OVERLOAD_MCS = 20` (lines
  15-16) — these are advisory ("Overload" badge) and do not block placement.

### NUS College (NUSC) base curriculum structure

Per NUSC official PDFs (AY2022-24 and AY2025/26+ cohorts, fetched 2026-07-10):

- Standard (non-SoC) NUSC curriculum is **56 UT**: pre-AY2025/26 cohorts = 4 Critical Competencies
  + 3 Global Orientation + 6 Making Connections Electives (MCEs, 4 UT each) + 1 Impact Experience
  (IEx, 8 UT); AY2025/26+ cohorts = 6 Global Critical Competencies + 6 MCEs + 1 IEx (8 UT).
- **SoC/Computing majors get a 52 UT NUSC total (not 56)**, because the 6th Global Critical
  Competency course ("Computational Problem Solving") is fulfilled by the major's own programming
  course (CS1010\*/CS1101S/CS2030S) and booked once under SoC Common Curriculum (8 UT) instead of
  under NUS College — verified verbatim from the official PDF's page-13 "Bachelor of Computing"
  table.
- **This is exactly what the app's data encodes**: all 5 majors below show a `nus-college` category
  with `mcTarget: 52` plus a separate `soc-common` category with `mcTarget: 8` (never a 56-MC
  `nus-college` category).

### Double counting / triple counting

Two distinct senses of "counting" apply:

- **Double counting / mapping** — one course satisfies two requirements at once (e.g. a major
  course also satisfies a minor requirement), but its Units/MCs count only **once** toward the
  160-UT degree total, never twice.
- **Triple counting** — one course counting toward major + NUSC/GE + minor simultaneously — is
  **forbidden**.

**Caps per NUSC rules:** 8 UT major↔GE/College overlap; 16 UT with a 2nd major; 8 UT with a
minor/specialisation.

**As implemented in code**, `src/lib/studyPlan.ts`:

- `computeDoubleCount(secondary, semesters, waivedModules)` (lines 176-192):
  - Finds every placed/waived module code that matches any `RequirementRule.fulfilledBy` entry in
    the secondary programme's (second major or minor) own requirements.
  - Sums their MCs into `doubleCountMc`.
  - **Cap formula: `capMc = secondary.mcTarget * 0.4`** — i.e. 16 MC for a 40-MC second major, 8 MC
    for a 20-MC minor. This generically reproduces the NUS 16 UT (2nd major) / 8 UT (minor) rule
    above, since it's derived from `mcTarget` rather than hard-coded per programme.
  - `warn: doubleCountMc > capMc` — a boolean flag, not a hard block; the UI surfaces it as a
    warning.
- `computeTripleCountedCodes(secondaries, semesters, waivedModules)` (lines 197-207):
  - Across **all** declared secondary programmes (a student can have 1 second major + up to 3
    minors per `StudentPlan.minorIds`), finds module codes that satisfy ≥1 requirement in **2 or
    more** secondary programmes simultaneously (implicit 1 primary-major count + 2 secondary counts
    = 3-way overlap). NUS explicitly forbids this; the function returns the offending codes so the
    UI can flag them.

### NOC (NUS Overseas Colleges) Programme-With-Waivers (PWW) MCE waiver rules

Per NUSC official PDFs (AY2022-24 and AY2025/26+ cohorts) and NUSC FAQs (updated 9 Apr 2026):

- NOC = "Programme-With-Waivers." It waives **Making Connections Electives (MCEs) only** — it
  cannot waive Faculty/SoC common curriculum requirements.
- **Generic (56-UT) majors:** 1-year NOC waives 4 of 6 MCEs → NUSC total drops to 40 UT; 6-month
  NOC waives 2 of 6 → 48 UT; 3-month NOC → no waiver, 56 UT unchanged.
- **SoC/NUSC majors (52-UT base):** 1-year NOC → 36 UT (52 − 16); 6-month NOC → 44 UT (52 − 8);
  3-month NOC → 52 UT unchanged.
- **The non-cumulative-waivers trap:** waivers from overlapping PWWs (e.g. NOC combined with
  CDE/XDP) are **not additive**. Verbatim from the official source: "the total number of Making
  Connection waivers will follow the PWW with the highest number of waivers." A student on two
  overlapping waiver programmes takes the higher single waiver count, not the sum.
- **Not currently modeled in app data or code** — no major JSON or logic in `studyPlan.ts` /
  `SemesterGrid.tsx` currently represents NOC/PWW waivers. This is a manual/advisory consideration
  outside the app's automated checks (see Section 5).

---

## 2. Majors (School of Computing, NUS College track)

All 5 majors are tagged `batches: ["AY2026/2027"]` and share `totalMcTarget: 160`. Common
requirement rows across all 5 (Thinking with Writing / Understanding the Social World / Reasoning
with Data / Global Narratives / Science and Society / Making Connections ×6 / Impact Experience) are
the NUS College Global Critical Competencies + MCE + IEx structure described in Section 1, all
tagged to the `nus-college` category (mcTarget 52) in each major.

### 2.1 Computer Science (NUS College) — `computer-science-nusc`

**Total: 160 MC.**

| Category | MC Target |
|---|---|
| CS Foundation | 36 |
| Breadth & Depth (Focus Area) | 32 |
| Math & Sciences | 12 |
| SoC Common Curriculum | 8 |
| NUS College | 52 |
| Unrestricted Electives | 20 |

**Requirement rows:**

| Requirement | Fulfilled by | Category |
|---|---|---|
| Programming Methodology | CS1101S | soc-common |
| Digital and AI Ethics | IS1108 | soc-common |
| Thinking with Writing | NTW* | nus-college |
| Understanding the Social World | NSW* | nus-college |
| Reasoning with Data | GEA1000N | nus-college |
| Global Narratives | NGN* | nus-college |
| Science and Society | NSS* | nus-college |
| Making Connections | NHS*, NFB*, NST*, NFC*, NHT* (count 6) | nus-college |
| Impact Experience Project | NEP* | nus-college |

**Breadth & Depth config** (`breadthDepth`, category `breadth-depth`):
- Total units: 32; min level-4000 units: 12.
- Industry Experience: 6–12 units from CP3880, IS4010, ETP3201L, CP3200, CP3202, CP3107, CP3110,
  ETP3205; dissertation alternative CP4101 waives this requirement entirely.
- Allowed prefixes for non-IE courses: CS, IFS, CP.
- Max CP-prefix units (excl. IE): 12.

**Focus Areas** (student must complete ≥1 of 11): Algorithms & Theory, Artificial Intelligence,
Computer Graphics & Games, Computer Security, Database Systems, Human-Computer Interaction,
Multimedia Information Retrieval, Networking & Distributed Systems, Parallel Computing, Programming
Languages, Software Engineering. Each has a `primaries` list (default: need 3 distinct, ≥1 at
level-4000+, per `computeFocusAreaStatus` defaults in `studyPlan.ts`) and a related-but-non-counting
`electives` list.

### 2.2 Artificial Intelligence (NUS College) — `artificial-intelligence-nusc`

**Total: 160 MC.**

| Category | MC Target |
|---|---|
| Computing Foundation | 20 |
| AI Foundation | 20 |
| Math & Sciences | 20 |
| AI Breadth & Depth | 20 |
| SoC Common Curriculum | 8 |
| NUS College | 52 |
| Unrestricted Electives | 20 |

**Requirement rows:**

| Requirement | Fulfilled by | Category |
|---|---|---|
| Programming Methodology | CS1101S | soc-common |
| Digital and AI Ethics | IS1108 | soc-common |
| Design and Analysis of Algorithms | CS3230 | computing-foundation |
| Intro to AI and Machine Learning | CS2109S | ai-foundation |
| Foundations of Artificial Intelligence | CS3263 | ai-foundation |
| Foundations of Machine Learning | CS3264 | ai-foundation |
| Responsible AI | CS3268 | ai-foundation |
| Perception | CS4243 or CS4248 | ai-foundation |
| NUS College GCC/MCE/IEx rows (7 rows, same structure as 2.1) | — | nus-college |

**Breadth & Depth config** (`breadthDepth`, category `ai-breadth-depth`):
- Total units: 20; min level-4000 units: 12.
- Technical Electives (AI has no named Focus Areas, unlike CS — this is a flat list instead):
  ≥12 units from CS4220, CS4225, CS4240, CS4244, CS4246, CS4261, CS4262, CS4277, CS4278, CS4347.
- Industry Experience: 6–12 units from CP3880, IS4010, ETP3201L, CP3200, CP3202, CP3107, CP3110,
  ETP3205; CP4101 dissertation alternative (GPA ≥ 4.00).
- Allowed prefixes: CS, IFS, IS, CP. Max CP-prefix units (excl. IE): 12.

Source: comp.nus.edu.sg/programmes/ug/ai/curr/, fetched live and cross-checked against a prior
research pass.

### 2.3 Business AI Systems (NUS College) — `business-ai-systems-nusc`

**Total: 160 MC.**

| Category | MC Target |
|---|---|
| BAIS Foundation | 48 |
| Math & Sciences | 12 |
| Programme Electives | 20 |
| SoC Common Curriculum | 8 |
| NUS College | 52 |
| Unrestricted Electives | 20 |

**Requirement rows:**

| Requirement | Fulfilled by | Category |
|---|---|---|
| Programming Methodology | CS1010A | soc-common |
| Digital and AI Ethics | IS1108 | soc-common |
| Data Management and Visualisation | BT2102 | bais-foundation |
| Full-stack SE for AI Solutions I | IS2108 | bais-foundation |
| AI and ML Techniques I | IS2109 | bais-foundation |
| AI Solutioning Capstone Project | IS4108 | bais-foundation |
| Industry Experience Requirement (12 MC, or CP4101 dissertation) | CP3880, IS4010, CP3200, CP3202, CP3107, CP3110, CP4101 (count 1) | bais-foundation |
| NUS College GCC/MCE/IEx rows (7 rows) | — | nus-college |

**Programme Electives config** (`programmeElectives`, category `bais-electives`): 20 units / 5
courses, ≥3 at level-4000. 6 named elective categories — Digital Business (3 codes), Financial
Technology (4), IT Solutioning (11), AI Solutioning (12), IT Business Innovation & Entrepreneurship
(5), IT Security & Legal Aspects (5) — see the JSON for full code lists. 3 optional Specialisation
tracks (informational, 5 courses each): AI Governance & Management, Digital Product & Platform
Management, Financial Technology. IS4108 (capstone) is always mandatory; CP4101 substitutes for the
*separate* 12 MC Industry Experience Requirement, not the capstone.

Source: comp.nus.edu.sg/programmes/ug/bais/curr/, fetched live 2026-07-10.

### 2.4 Business Analytics (NUS College) — `business-analytics-nusc`

**Total: 160 MC.**

| Category | MC Target |
|---|---|
| BA Foundation | 52 |
| Math & Sciences | 12 |
| Programme Electives | 20 |
| SoC Common Curriculum | 8 |
| NUS College | 52 |
| Unrestricted Electives | 16 |

**Requirement rows:**

| Requirement | Fulfilled by | Category |
|---|---|---|
| Programming Methodology | CS1010A | soc-common |
| Digital and AI Ethics | IS1108 | soc-common |
| Introduction to Business Analytics | BT1101 | ba-foundation |
| Econometrics Modeling for Business Analytics | BT2101 | ba-foundation |
| Application Systems Development for BA | BT3103 | ba-foundation |
| Business Analytics Capstone Project | BT4103 | ba-foundation |
| NUS College GCC/MCE/IEx rows (7 rows) | — | nus-college |

**Programme Electives config** (`programmeElectives`, category `ba-electives`): 20 units / 5
courses, ≥3 at level-4000, ≥3 BT-coded. 3 named elective categories — Business Applications (12
codes), Analytics Methods (15), Technology Implementation (10). 3 optional Specialisation tracks
(informational, 5 courses each): Financial Analytics, Machine Learning-based Analytics, Marketing
Analytics. BT4103 (capstone, 8 MC) is always mandatory; BT4101 (12 MC) serves as either the
dissertation or the Industry Experience Requirement.

Source: comp.nus.edu.sg/programmes/ug/ba/curr/, fetched live 2026-07-10. Note: Unrestricted
Electives is 16 MC here (vs 20 MC for CS/AI/BAIS) — the totals still sum to 160.

### 2.5 Information Security (NUS College) — `information-security-nusc`

**Total: 160 MC.**

| Category | MC Target |
|---|---|
| Computing Foundation | 32 |
| Security Requirements | 28 |
| Industrial Experience | 12 |
| Math & Sciences | 12 |
| SoC Common Curriculum | 8 |
| NUS College | 52 |
| Unrestricted Electives | 16 |

**Requirement rows:**

| Requirement | Fulfilled by | Category |
|---|---|---|
| Programming Methodology | CS1010 | soc-common |
| Digital and AI Ethics | IS1108 | soc-common |
| Intro to Computer Networks | CS2105 | computing-foundation |
| Intro to Information Security | CS2107 | security-requirements |
| Computer Security | CS3235 | security-requirements |
| Information Security Management | IS4231 | security-requirements |
| Information Security Capstone Project | IFS4205 | security-requirements |
| Security Electives (8 MC) | CS4230, CS4236, MA4261, CS4238, CS4239, CS4257, CS4276, CS5231, CS5321, CS5322, CS5331, CS5332, IFS4101–4103, IS4204, IS4233, IS4234, IS4238, IS4302 (count 2) | security-requirements |
| Industrial Experience (≥ 6 MC, or CP4101 dissertation) | CP3880, IS4010, TR3202, CP3200, CP3202, CP3107, CP3110, CP4101 (count 1) | industrial-experience |
| NUS College GCC/MCE/IEx rows (7 rows) | — | nus-college |

No `breadthDepth`/`programmeElectives` config — modeled instead as two flat-pool requirement rows
(count-based, approximating the real MC minimums). **Known simplification:** the real rule allows
IFS4205 (8 MC, 1 course) OR the pair CS4238 + IFS4103 together (8 MC, 2 specific courses) as
alternate paths to the capstone requirement — the app only checks for IFS4205 alone; the pair
alternative isn't specially modeled (both codes are still available in the Security Electives pool).

Source: comp.nus.edu.sg/programmes/ug/isc/curr/, fetched live 2026-07-10.

---

## 3. Second Majors

All 7 second-major programmes are `kind: "second-major"`, `mcTarget: 40`. Per Section 1's double
count formula, double-counting with the primary major is capped at `40 * 0.4 = 16 MC`.

### 3.1 Economics — `second-majors/economics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Economic Analysis | EC1101E | 1 |
| Microeconomic Analysis I | EC2101 | 1 |
| Macroeconomic Analysis I | EC2102 | 1 |
| Quantitative Methods for Economic Analysis | EC2104 | 1 |
| Foundations for Econometrics | EC2303 | 1 |
| Microeconomic Analysis II | EC3101 | 1 |
| Macroeconomic Analysis II | EC3102 | 1 |
| Econometrics I | EC3303 | 1 |
| Level-3000+ Economics (incl. EC3101/EC3102/EC3303) | EC3*, EC4* | 4 |
| Economics courses toward 40 MC total (incl. cores) | EC* | 10 |

### 3.2 Psychology — `second-majors/psychology.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Psychology | PL1101E | 1 |
| Research and Statistical Methods I | PL2131 | 1 |
| Research and Statistical Methods II | PL2132 | 1 |
| Biological Psychology | PL3102 | 1 |
| Cognitive Psychology | PL3103 | 1 |
| Developmental Psychology | PL3104 | 1 |
| Social Psychology | PL3105 | 1 |
| Mental Health and Distress | PL3106 | 1 |
| Level-2000/3000 Psychology beyond cores | PL2*, PL3* | 9 |

### 3.3 Data Analytics — `second-majors/data-analytics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Data Science | DSA1101 | 1 |
| Data Structures and Algorithms | CS2040, CS2040C, CS2040S | 1 |
| Probability | ST2131, MA2116 | 1 |
| Mathematical Statistics | ST2132 | 1 |
| Data Visualisation or Numerical Computation | DSA2101, DSA2102 | 1 |
| Calculus | MA1521, MA2002, MA1312, MA1505 | 1 |
| Linear Algebra | MA1522, MA2001, MA1508E | 1 |
| Optimisation | DBA3701, DSA3102, MA3236, MA3252 | 1 |
| Advanced electives | CS3244, CS3264, DSA4211, DSA4212, ST3131 | 2 |

### 3.4 Management — `second-majors/management.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Foundation Business courses | MNO1706X, PL3239, ACC1701X, EC2204, MKT1705X, BSP1702X, BSP1703X, EC1101E, DAO1704X | 4 |
| Advanced electives Level-2000 | ACC27*, DAO27*, MNO27*, RE27*, EC2102 | 2 |
| Advanced electives Level-3000 | ACC37*, DBA37*, DBA38*, BSE37*, FIN37*, BSN37*, ETP32*, IS3251, MNO37*, MKT37*, DOS37*, RE37*, RE38* | 3 |
| Advanced Business electives, 24 MC total (6 courses, union of the above two pools) | (union of Level-2000 + Level-3000 lists) | 6 |

### 3.5 Mathematics — `second-majors/mathematics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Calculus | MA1521, MA1102R | 1 |
| Linear Algebra II | MA2101, MA2101S | 1 |
| Multivariable Calculus | MA2104 | 1 |
| Mathematical Analysis I | MA2108, MA2108S | 1 |
| Probability | MA2216, ST2131 | 1 |
| 3000+ Mathematics electives | MA3*, MA4* | 2 |
| Additional 3000+ elective | MA3*, MA4*, ST3236, ST4238 | 1 |

### 3.6 Public Health — `second-majors/public-health.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Fundamental Public Health Methods | SPH2001 | 1 |
| Public Health and Epidemiology | SPH2002 | 1 |
| Systems and Policies to Improve Health | SPH2003 | 1 |
| Lifestyle, Behaviour and Public Health | SPH2004 | 1 |
| Health, Society and the Social Determinants | SPH2005 | 1 |
| Public Health Practice | SPH3001 | 1 |
| SPH-coded courses incl. cores + ≥8 MC electives | SPH*, GEC1015 | 8 |
| Level-3000+ courses, 12 MC electives incl. SPH3001 | SPH3*, SPH5* | 4 |

### 3.7 Statistics — `second-majors/statistics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Statistics | ST1131 | 1 |
| Calculus | MA1521, MA1102R | 1 |
| Linear Algebra | MA1101R, MA1508E | 1 |
| Mathematical Statistics | ST2132 | 1 |
| Computer-Aided Data Analysis | ST2137 | 1 |
| Statistics electives | ST3131, ST32*, ST42* | 3 |
| Additional Statistics elective | ST32*, ST42* | 1 |

---

## 4. Minors

All 9 minor programmes are `kind: "minor"`, `mcTarget: 20`. Per Section 1's double count formula,
double-counting with the primary major is capped at `20 * 0.4 = 8 MC`.

### 4.1 Statistics — `minors/statistics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Statistics | ST1131 | 1 |
| Calculus | MA1521, MA2002, MA1312, MA1505 | 1 |
| Probability | ST2131, MA2116, ST2334 | 1 |
| Mathematical Statistics or Statistical Computing | ST2132, ST2137 | 1 |
| Level-3000 Statistics | ST3131, ST32* | 1 |

### 4.2 Quantitative Finance — `minors/quantitative-finance.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Quantitative Finance | QF1100 | 1 |
| Level-2000 mathematics | MA2301, MA2002, MA1312, MA1505, MA1507, MA1521, MA2001, MA1508E, MA1522, MA2216, MA2116, ST2131, ST2334 | 1 |
| Fundamentals of Quantitative Finance | QF2104 | 1 |
| Investment Instruments and Risk Management | QF3101 | 1 |
| Level-3000 elective | QF3103, ST3131, EC3303, FIN3702, FIN3716 | 1 |

### 4.3 Economics — `minors/economics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Economic Analysis | EC1101E | 1 |
| Microeconomic or Macroeconomic Analysis I | EC2101, EC2102 | 1 |
| Economics courses toward 20 MC total (incl. above) | EC* | 5 |

### 4.4 Psychology — `minors/psychology.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Introduction to Psychology | PL1101E | 1 |
| Psychology electives, 16 MC | PL2131, PL3102, PL3103, PL3104, PL3105, PL3106 | 4 |

### 4.5 Public Health — `minors/public-health.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Fundamental Public Health Methods | SPH2001 | 1 |
| Public Health and Epidemiology | SPH2002 | 1 |
| SPH-coded courses incl. cores + ≥8 MC electives | SPH*, GEC1015 | 4 |
| Level-3000 electives, 8 MC | SPH3* | 2 |

### 4.6 Data Analytics — `minors/data-analytics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Level-1000 foundation | BT1101, DSA1101, GEA1000, GEA1000N, ST1131 | 1 |
| Data Visualisation | DSA2101 | 1 |
| Level-2000 mathematics/statistics | MA1522, MA2001, MA1508E, ST2334 | 1 |
| Inferential Data Analytics | DSA3361 | 1 |
| Level-3000 elective | DBA3701, DSA3102, DSA3362 | 1 |

### 4.7 Entrepreneurship — `minors/entrepreneurship.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Foundation Business courses, 8 MC | BSP1702(X), MKT1705(X), FIN2704(X), MNO1706(X), PL3239, ACC1701(X), EC2204, BSP1703(X), EC1101E, EC1301 | 2 |
| Advanced entrepreneurship courses, 12 MC | ACC2706, BSN3703, BSN3712, BSN3717, ETP3211, BSN3702, BSN3701, IS3251 | 3 |

### 4.8 Management — `minors/management.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Foundation Business courses, 8 MC | MNO1706X, PL3239, ACC1701X, EC2204, MKT1705X, BSP1702X, BSP1703X, EC1101E, DAO1704X | 2 |
| Advanced electives Level-2000 | ACC27*, DAO27*, MNO27*, RE27*, EC2102 | 2 |
| Advanced elective Level-3000 | ACC37*, DBA37*, DBA38*, BSE37*, FIN37*, BSN37*, ETP32*, IS3251, MNO37*, MKT37*, DOS37*, RE37*, RE38* | 1 |

### 4.9 Mathematics — `minors/mathematics.json`

| Requirement | Fulfilled by | Count |
|---|---|---|
| Foundational Mathematics module | MA1521, MA1102R, CS1231, CS1231S | 2 |
| 2000-level Mathematics elective or ST2131 | MA2*, ST2131 | 2 |
| 3000+ Mathematics elective or ST3236/ST4238 | MA3*, MA4*, ST3236, ST4238 | 1 |

---

## 5. Known gaps / not yet modeled

**Resolved since the first version of this document (2026-07-10):** all 4 non-CS majors' elective
structures are now modeled. AI got a `breadthDepth` config (reusing CS's schema, extended with a new
`technicalElectives` field since AI has no named Focus Areas). Business Analytics and Business AI
Systems got a new `programmeElectives` schema (named elective categories + optional Specialisation
tracks — a different shape from `breadthDepth`, since their rule is "N courses from named pools with
cross-cutting minimums," not "complete one Focus Area"). Information Security got two new flat-pool
requirement rows (Security Electives, Industrial Experience). All new module codes were verified live
against comp.nus.edu.sg and cross-checked module-by-module against the NUSMods API. See Section 2 for
the resulting per-major detail. A pre-existing gap in Computer Science's own data was also fixed in
passing: its `breadthDepth.industryExperience.courses` list referenced codes that were never added to
its `moduleCatalog`.

Remaining genuine gaps, not invented:

- **NOC / Programme-With-Waivers is still not represented anywhere in the app.** No major JSON, minor
  JSON, second-major JSON, or logic in `studyPlan.ts`/`SemesterGrid.tsx` encodes the MCE-waiver
  mechanics described in Section 1 (waived UT counts, the non-cumulative-waivers rule). A student
  on NOC currently has no way to reflect a reduced NUS College MC target in the app. This is the
  one remaining gap from the original list — it needs a small code change (something has to adjust
  the `nus-college` category's MC target and the Making Connections requirement count when NOC is
  declared), not just data authoring, so it was deferred as a separate follow-up.
- **Information Security's capstone alternative isn't fully modeled**: the real rule allows IFS4205
  (8 MC) OR the pair CS4238 + IFS4103 together as alternate paths — the app only checks for IFS4205
  alone. Low-impact (both codes are still in the Security Electives pool, just not linked as a
  specific alternate pair).
- **The `computeDoubleCount` cap (`mcTarget * 0.4`) is a generic derivation**, not a rule read from
  each programme's own official double-counting allowance — it assumes every second major allows
  exactly 16 MC overlap and every minor allows exactly 8 MC, which matches the general NUS rule but
  would not reflect any programme-specific exception if one existed.
- **`UNDERLOAD_MCS` (16) and `OVERLOAD_MCS` (20) in `SemesterGrid.tsx`** are advisory load-balance
  hints, not NUS-mandated caps — worth distinguishing from the hard Y1S1 26-MC cap when presenting
  this to faculty, since only the Y1S1 cap reflects an actual NUS rule.
- **Programme elective / breadth-depth module lists drift yearly** — like every module list in this
  document, re-verify against the live comp.nus.edu.sg page for the cohort actually being targeted
  before treating any of Section 2's lists as current beyond the AY2026/2027 data tag.
