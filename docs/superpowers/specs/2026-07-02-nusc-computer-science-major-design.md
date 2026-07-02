# Computer Science (NUS College) major — design

## Context

`shared/data/majors/computer-science.json` models the BComp Computer Science
curriculum, but was built as a rough mix of NUSC-track and generic
university-level-requirement (ULR) data. Research against official NUS
SoC/NUSC sources (see below) turned up:

- 6 real graduation requirements missing from the `requirements` checklist
  entirely (Singapore Studies, Critique & Expression, SOC Cross-Disciplinary
  Course, Interdisciplinary Courses, Communities & Engagement, plus the
  Writing/Data-Literacy rows only covering one hardcoded course code each).
- Miscategorized modules: `MA1521`/`MA1522`/`ST2334` (Math & Sciences) tagged
  under the `soc-nusc` MC category, which is really meant for Common
  Curriculum content.
- No distinction between "always required regardless of college"
  (`CS1101S`, `IS1108`) vs "NUSC-track-specific" vs "standard-track-specific"
  requirements.
- `RequirementRule.fulfilledBy` only supported exact-code matching, but many
  real requirements are satisfied by a *family* of section codes (e.g.
  `NTW2035`, `NTW2036`, ... all count as "Thinking with Writing").

Sources used: comp.nus.edu.sg CS curriculum pages (cohort 2025/2026),
NUS College's own "NUSC Requirements → SOC Requirements Satisfied" mapping
table (user-provided, primary source), and the live NUSMods API
(`api.nusmods.com/v2/2025-2026/moduleList.json`) for confirming real,
current course codes.

## Scope

This spec covers **one major only**: a from-scratch, NUSC-specific
Computer Science major definition. It does not cover:

- A standard (non-NUSC) Computer Science major — deferred, separate task.
- CS Focus Areas (the 32 MC "Breadth & Depth" category stays empty — no
  module data yet, needs its own research pass).
- Industry Experience / Dissertation modeling.
- Any other major besides Computer Science.

### Why a separate major file, not a runtime toggle

The app already has a working extensibility mechanism for curriculum
variation: the major registry (`shared/data/majors/*.json`, auto-loaded via
`import.meta.glob`, no code changes needed to add one). Modeling "NUSC vs
standard track" as two separate major entries reuses this mechanism as-is —
no new schema, no new persisted student setting, no new UI. The existing
"switching major resets your plan" confirmation flow already handles
students picking the wrong track.

Considered and rejected for now:
- **Single major + in-app "I'm in NUS College" toggle** — needs conditional
  categories/requirements, new hook logic, new persisted state. More
  surface area for the same practical outcome.
- **Shared NUSC "overlay" JSON merged at load time** — avoids duplicating
  the NUS College block across future majors, but needs new merge logic in
  the loader. Worth doing if/when a 3rd or 4th major is added and
  duplication actually hurts; premature now.

### File plan

The existing `shared/data/majors/computer-science.json` already contains
NUSC-flavored data from earlier iteration. Rather than leave a
half-generic, half-NUSC file in place, it will be renamed to
`shared/data/majors/computer-science-nusc.json`, with:
- `id`: `"computer-science-nusc"`
- `label`: `"Computer Science (NUS College)"` — distinguishes it from a
  future standard-track entry in the major-picker dropdown
- `specialisation`: unchanged (`"Networking and Distributed Systems"` —
  this field identifies the CS Focus Area, not the college track)

A clean standard-track `computer-science.json` is a separate future task.

## Categories

6 categories (chosen over a simpler 4-category split specifically to give
visibility into Math & Sciences separately, and over an even-more-granular
split of NUS College, per user preference):

| Category id | Label | MC Target | Modules |
|---|---|---|---|
| `cs-foundation` | CS Foundation | 36 | CS1231(S), CS2030S, CS2040S, CS2100, CS2101, CS2103T, CS2106, CS2109S, CS3230 |
| `breadth-depth` | Breadth & Depth (Focus Area) | 32 | *(empty — Focus Area research is out of scope)* |
| `math-sciences` | Math & Sciences | 12 | MA1521, MA1522, ST2334 |
| `soc-common` | SoC Common Curriculum | 8 | CS1101S, IS1108 |
| `nus-college` | NUS College | ~52 (approximate — see Open Questions) | NTW\*, NSW\*, GEA1000N, NGN\*, NSS\*, Making Connections modules, NEP\* |
| `unrestricted-electives` | Unrestricted Electives | ~20 (approximate) | free choice, no fixed codes |

Total target: 36 + 32 + 12 + 8 + 52 + 20 = 160 MC, matching the official
BComp total.

**Judgment call, resolved:** `CS1101S`'s 4 MC officially come from the
university's Common Curriculum bucket (Digital Literacy pillar), not the
Major Requirements bucket, even though it's pedagogically a CS course. It's
categorized under `soc-common`, not `cs-foundation`, per official
unit-accounting.

**Existing miscategorization this fixes:** `MA1521`/`MA1522`/`ST2334`
currently sit under the old `soc-nusc` category (mistakenly conflating Math
& Sciences with Common Curriculum content) — they move to `math-sciences`.

## Requirements

`RequirementRule` gains a `categoryId` field so the requirements checklist
can group by category instead of rendering one flat list. Full set:

**`soc-common` (2 rows)**

| Requirement | `fulfilledBy` |
|---|---|
| Programming Methodology | `["CS1101S"]` |
| Digital and AI Ethics | `["IS1108"]` |

**`nus-college` (7 rows, covering 12 of the 13 real course slots — the 13th, Computational Problem Solving, is intentionally not a row; see below)**

| Requirement | `fulfilledBy` | `count` |
|---|---|---|
| Thinking with Writing | `["NTW*"]` | 1 |
| Understanding the Social World | `["NSW*"]` | 1 |
| Reasoning with Data | `["GEA1000N"]` | 1 |
| Global Narratives | `["NGN*"]` | 1 |
| Science and Society | `["NSS*"]` | 1 |
| Making Connections | `["NHS*", "NFB*", "NST*", "NFC*", "NHT*"]` | 6 |
| Impact Experience Project | `["NEP*"]` | 1 |

**Explicitly not modeled:**
- **Computational Problem Solving (NPS)** — per the source table, this is
  auto-satisfied by `CS1101S` for CS majors ("fulfilled through SOC's
  curriculum"), so no separate row.
- **Cultures & Connections (conditional)** — the source table lists this as
  satisfied only if a student's specific Making Connections course happens
  to be tagged for it, which this app's data can't distinguish (no
  per-section tagging available). Dropped rather than guessed. Flagged here
  so it doesn't silently disappear from institutional memory — a student
  should verify this one manually against their specific module.
- **Making Connections HSS/ST/flexible sub-mix** (2 HSS + 2 ST + 2
  flexible) — the `count: 6` row checks "6 distinct Making Connections
  courses total," not the sub-type balance. Acceptable for a personal
  planning tool; not a compliance auditor.

## Schema changes

- `shared/types.ts`: `RequirementRule` gains `categoryId: string` (required
  going forward for this major; existing `count`/prefix-match support from
  the prior change stays as-is).
- `src/components/RequirementsChecklist.tsx`: render grouped by
  `categoryId` (section header = category label) instead of one flat
  `<ul>`. Order of sections follows the major's `categories` array order.
- No changes needed to `computeRequirements` matching logic — already
  supports prefix (`*`) and `count`.

## Data changes

- Rename `shared/data/majors/computer-science.json` →
  `shared/data/majors/computer-science-nusc.json`.
- Update `id`, `label`, `specialisation` to identify the NUS College track.
- Replace `categories` with the 6-category table above.
- Replace `requirements` with the `soc-common` + `nus-college` rows above
  (each with a `categoryId`).
- Re-tag every `defaultPlan` entry's `categoryId` to match the new category
  ids (`cs-foundation`, `math-sciences`, `soc-common` — `nus-college` and
  `breadth-depth` have no default-plan entries yet since there's no
  confirmed default course selection for electives/focus areas).
- `moduleCatalog` stays as the source of truth for module names/MCs for
  anything in the default plan; no changes needed beyond what's already
  there (CS1101S, IS1108, MA1521, MA1522, ST2334, NTW2035, GEA1000N, CS
  Foundation codes).

## Open questions / explicitly deferred

- **Exact NUS College MC target** — sources disagree slightly (52 vs 56
  units) depending on how the Impact Experience Project's 8-MC weight is
  counted against the "13 courses" figure. Target is left as an
  approximate `~52` pending verification (e.g. against the user's own
  degree audit, which would be authoritative).
- **`CS1231` vs `CS1231S`** — the current catalog/default-plan uses the
  bare `CS1231` code, but current NUS documentation lists `CS1231S`
  (Discrete Structures) as the live code. Not fixed as part of this spec
  (flagged previously, still open) — worth a follow-up.
- **Focus Area module lists** — `breadth-depth` category has no modules or
  default-plan entries. A future task should research the 10 official
  Focus Areas' "Area Primary" module codes (starting with Networking &
  Distributed Systems, matching the current `specialisation` field).
- **Standard (non-NUSC) `computer-science.json`** — a separate future task,
  out of scope here.
