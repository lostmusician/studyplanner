# Other SoC majors (NUS College track) — design

## Context

The planner currently ships a single major,
`shared/data/majors/computer-science-nusc.json` (Computer Science, NUS
College track). Majors are auto-registered by the loader
(`src/hooks/useStudyPlan.ts`, `import.meta.glob('../../shared/data/majors/*.json')`)
— **adding a new major is pure data authoring; no code changes are needed.**

This spec adds the four other undergraduate majors offered by the NUS
School of Computing, each modeled for the **NUS College (NUSC) track** to
match the existing CS major:

1. **Artificial Intelligence** — `artificial-intelligence-nusc`
   (BComp in Artificial Intelligence, the new AI major)
2. **Business Artificial Intelligence Systems** — `business-ai-systems-nusc`
   (BComp in BAIS — *formerly* Bachelor of Computing in Information Systems;
   NUS renamed the IS degree to BAIS)
3. **Business Analytics** — `business-analytics-nusc`
   (BSc Business Analytics)
4. **Information Security** — `information-security-nusc`
   (BComp in Information Security)

Sources: official comp.nus.edu.sg curriculum pages (cohort 2025/2026) for
each programme, cross-checked against the existing CS-NUSC file as the
structural template.

## Scope

- **In scope:** four new `shared/data/majors/*.json` files, each with
  `categories`, grouped `requirements`, `moduleCatalog`, and a
  semester-by-semester `defaultPlan`. Reuse of the NUS College block from
  the existing CS-NUSC file.
- **Out of scope (deferred, matching the CS-NUSC precedent):**
  - Programme-elective / focus-area / specialisation module lists — the
    "Breadth & Depth"–style elective categories ship with an MC target but
    an **empty catalog** (free choice), exactly as CS-NUSC's `breadth-depth`.
  - A standard (non-NUSC) variant of any major.
  - Any code/schema change. The existing `Major`/`MajorCategory`/
    `RequirementRule` schema and `RequirementsChecklist` grouping already
    support everything these files need.

## Shared approach

Every NUSC SoC student shares the same **NUS College block**, so all four
files reuse it verbatim from `computer-science-nusc.json`:

- Category `nus-college` (mcTarget 52, color `#b8c9d4`) and category
  `soc-common` (mcTarget 8, color `#abb89b`).
- The 7 `nus-college` requirement rows (Thinking with Writing `NTW*`,
  Understanding the Social World `NSW*`, Reasoning with Data `GEA1000N`,
  Global Narratives `NGN*`, Science and Society `NSS*`, Making Connections
  `[NHS*,NFB*,NST*,NFC*,NHT*]` count 6, Impact Experience Project `NEP*`).
- The `soc-common` requirement rows: **Digital and AI Ethics** (`IS1108`)
  plus a **Programming Methodology** row that differs per major (see below).
- Catalog entries for the shared codes: `IS1108`, `MA1521`, `MA1522`,
  `ST2334`, `NTW2035`, `GEA1000N`, `MA1301` (waiver example).

### MC budgeting convention

All four programmes are 160 MC. Following the CS-NUSC precedent, the NUSC
block (52 + 8 = 60 MC) is larger than a standard Common Curriculum (40 MC),
so **Unrestricted Electives shrink** to keep the total at 160. MC targets
are *approximate* (same caveat CS-NUSC flags for `nus-college ~52`;
depends on how the 8-MC Impact Experience Project is counted).

### Programming methodology per major

Per user direction, **each major uses its own required first programming
course** (not a universal CS1101S). Confirmed from curriculum pages:

| Major | Programming module | Catalog name |
|---|---|---|
| Artificial Intelligence | `CS1101S` | Programming Methodology |
| Business AI Systems (BAIS) | `CS1010A` | Programming Methodology |
| Business Analytics | `CS1010A` | Programming Methodology |
| Information Security | `CS1010` | Programming Methodology |

Each sits in that major's `soc-common` category, and is the `fulfilledBy`
code of that major's "Programming Methodology" requirement row.

## Per-major definitions

### 1. Artificial Intelligence — `artificial-intelligence-nusc`

`label`: "Artificial Intelligence (NUS College)", `school`: "School of
Computing". Structure mirrors CS-NUSC closely.

| Category id | Label | MC | Modules |
|---|---|---|---|
| `computing-foundation` | Computing Foundation | 20 | CS2030S, CS2040S, CS2101, CS2103T, CS3230 |
| `ai-foundation` | AI Foundation | 20 | CS2109S, CS3263, CS3264, CS3268, CS4243 (Perception; or CS4248) |
| `math-sciences` | Math & Sciences | 20 | CS1231S, CS2251, MA1521, MA1522, ST2334 |
| `ai-breadth-depth` | AI Breadth & Depth | 20 | *(empty — technical electives)* |
| `soc-common` | SoC Common Curriculum | 8 | CS1101S, IS1108 |
| `nus-college` | NUS College | 52 | *(reused block)* |
| `unrestricted-electives` | Unrestricted Electives | 20 | free |

Total 160.

### 2. Business AI Systems (BAIS) — `business-ai-systems-nusc`

`label`: "Business AI Systems (NUS College)". Note in the file/commit that
BAIS is the rebrand of the former Information Systems degree.

| Category id | Label | MC | Modules |
|---|---|---|---|
| `bais-foundation` | BAIS Foundation | 48 | CS2030, CS2040, BT2102, IS2101, IS2108, IS2109, IS3103, IS4108 (capstone, 8), IE/CP4101 (12) |
| `math-sciences` | Math & Sciences | 12 | MA1521, MA1522, ST2334 |
| `bais-electives` | Programme Electives | 20 | *(empty)* |
| `soc-common` | SoC Common Curriculum | 8 | CS1010A, IS1108 |
| `nus-college` | NUS College | 52 | *(reused block)* |
| `unrestricted-electives` | Unrestricted Electives | 20 | free |

Total 160. (48 + 12 + 20 + 8 + 52 + 20)

### 3. Business Analytics — `business-analytics-nusc`

`label`: "Business Analytics (NUS College)", `school`: "School of Computing".

| Category id | Label | MC | Modules |
|---|---|---|---|
| `ba-foundation` | BA Foundation | 52 | BT1101, BT2101, BT2102, CS2030, CS2040, IS2101, BT3103, IS3103, BT4103 (capstone, 8), BT4101 (IE/dissertation, 12) |
| `math-sciences` | Math & Sciences | 12 | MA1521, MA1522, ST2334 |
| `ba-electives` | Programme Electives | 20 | *(empty)* |
| `soc-common` | SoC Common Curriculum | 8 | CS1010A, IS1108 |
| `nus-college` | NUS College | 52 | *(reused block)* |
| `unrestricted-electives` | Unrestricted Electives | 16 | free |

Total 160. (52 + 12 + 20 + 8 + 52 + 16)

### 4. Information Security — `information-security-nusc`

`label`: "Information Security (NUS College)", `school`: "School of Computing".

| Category id | Label | MC | Modules |
|---|---|---|---|
| `computing-foundation` | Computing Foundation | 32 | CS1231S, CS2030, CS2040C, CS2100, CS2101, CS2103T, CS2105, CS2106 |
| `security-requirements` | Security Requirements | 28 | CS2107, CS3235, IS4231, IFS4205 (capstone, 8), + 8 MC electives (empty in catalog) |
| `industrial-experience` | Industrial Experience | 12 | *(empty — CP3200/CP3202/CP3880/etc., free choice)* |
| `math-sciences` | Math & Sciences | 12 | MA1521, MA1522, ST2334 |
| `soc-common` | SoC Common Curriculum | 8 | CS1010, IS1108 |
| `nus-college` | NUS College | 52 | *(reused block)* |
| `unrestricted-electives` | Unrestricted Electives | 16 | free |

Total 160. (32 + 28 + 12 + 12 + 8 + 52 + 16)

## Requirements rows per major

Each file's `requirements` array = the shared NUS College block (7 rows) +
shared `soc-common` rows (Programming Methodology with the major's own code,
Digital and AI Ethics `IS1108`) + a small number of major-specific core
rows grouped under the major's foundation category. Major-specific rows use
exact-code `fulfilledBy` for named required cores (e.g. AI:
`CS3263`,`CS3264`; InfoSec: `CS2107`,`CS3235`,`IS4231`; BAIS:
`IS2108`,`IS2109`; BA: `BT2101`,`BT3103`). Elective/industrial-experience
categories with empty catalogs get **no** requirement rows (nothing to
check against), matching CS-NUSC's `breadth-depth`.

`RequirementRule.categoryId` groups each row under its category in the
checklist — already supported, no code change.

## Default plans

Each major gets a `defaultPlan` placing its required foundation, math, and
core modules across Y1–Y3 (spilling into Y4 where a capstone/IE lives),
in prerequisite-respecting order, mirroring how CS-NUSC front-loads its
core. Rules:

- Only modules with confirmed fixed codes are placed. Elective / breadth /
  industrial-experience categories (empty catalogs) get **no** default-plan
  entries.
- Respect the existing SemesterGrid per-semester load warning (soft cap;
  aim for ~4–5 modules/semester, ≤ the warning threshold).
- Programming methodology + early math/DS in Y1; capstone + IE in Y4.

Exact per-semester placement is an implementation detail (authored to be
prerequisite-valid and load-balanced), not enumerated here.

## Module catalog

Each file's `moduleCatalog` holds every code referenced by its
`defaultPlan` and by its exact-code requirement rows, with official
names/MCs (verified against curriculum pages; NUSMods for any ambiguous
name). Shared codes (IS1108, MA152x, ST2334, NTW2035, GEA1000N) are copied
into each file — the schema has no cross-file sharing, and CS-NUSC already
duplicates these. Capstone modules (IS4108, BT4103, IFS4205) carry their
real 8-MC weight; IE/dissertation slots (CP4101/BT4101) carry 12 MC.

## Judgment calls / open questions

- **Approximate MC targets** — carried over from CS-NUSC; a student should
  verify against their own degree audit.
- **`CS1231` vs `CS1231S`** — AI and InfoSec curricula list `CS1231S`
  (current live code). New files use `CS1231S`. (The old CS-NUSC file still
  uses bare `CS1231`; not touched here — pre-existing, separate follow-up.)
- **`CS2040` vs `CS2040S` vs `CS2040C`** — codes are used as the individual
  curricula list them: AI uses `CS2040S`, InfoSec uses `CS2040C`, BAIS/BA
  use `CS2040`. Same for `CS2030` vs `CS2030S`.
- **Perception choice (AI)** — `CS4243` placed as the default; `CS4248` is
  the alternative. Only one is placed in the default plan.
- **Cultures & Connections (conditional NUSC req)** — dropped, same as
  CS-NUSC (app data can't distinguish per-section tagging).
- **No changes to `computer-science-nusc.json`** — the existing CS major is
  left exactly as-is.
