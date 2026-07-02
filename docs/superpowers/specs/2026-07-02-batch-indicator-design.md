# Batch indicator — design

## Context

Each major in `shared/data/majors/*.json` models a specific curriculum
version, sourced from official NUS pages for a particular matriculation
cohort (e.g. the SoC-majors spec notes "cohort 2025/2026"). Nothing in the
app currently surfaces which student batch(es) — i.e. which AY intake
year(s) — a given major's requirements apply to. A student picking or
reviewing a planner has no way to tell whether it matches their own
matriculation batch without inspecting the underlying data.

## Goal

Add a clear, always-visible indicator of the applicable batch(es) at the
two places a student chooses or reviews their planner: the header major
selector and the Settings → Programme section. Support both a major that
applies to a single batch and one that applies to several.

## Data model

`shared/types.ts`: `Major` gains a required field:

```ts
export interface Major {
  ...
  /** Matriculation batches this major's data applies to, e.g. ["AY2025/2026"]
   * or ["AY2023/2024", "AY2024/2025", "AY2025/2026"] for a curriculum that
   * hasn't changed across multiple intakes. */
  batches: string[];
}
```

A plain string list, not a `{ from, to }` range — consistent with how
`RequirementRule.fulfilledBy` is already a flat list of strings, and avoids
assuming batch ranges are always contiguous (a curriculum could apply to
non-adjacent cohorts if it was reverted and reinstated, for example).

## Data population

None of the 5 existing majors have researched batch-applicability history
(the specs only confirm the data was sourced against "cohort 2025/2026"
curriculum pages). All 5 get:

```json
"batches": ["AY2025/2026"]
```

This is accurate to what's actually verified. Multi-batch support ships in
the schema and UI but isn't populated with real historical-applicability
data until a future research pass confirms which majors' curricula are
unchanged across earlier cohorts.

Files updated: `artificial-intelligence-nusc.json`,
`business-ai-systems-nusc.json`, `business-analytics-nusc.json`,
`computer-science-nusc.json`, `information-security-nusc.json`.

`admin/src/App.tsx`'s `newMajor()` factory gets the same default
(`batches: ['AY2025/2026']`) so a newly-created major in the admin tool
isn't born without one.

## Display

New `src/components/BatchBadge.tsx`:

```ts
interface Props {
  batches: string[];
}
```

Renders a single pill matching the existing chip style used elsewhere in
the app (`StatsSummary.tsx`'s `ConstraintChip`/`FocusAreaChip`: `rounded-full
px-2.5 py-1 text-[11px]`, muted background/foreground). Label text is
`batches.join(', ')` — for a single entry that's just `AY2025/2026`; for
multiple it reads e.g. `AY2023/2024, AY2024/2025, AY2025/2026`. No entries
(empty array, defensive only) renders nothing.

### Placement

1. **Header** (`src/components/StudyPlan.tsx`, `MajorHeaderSelect`): the
   badge sits next to the existing `major.school` line, so the meta row
   reads e.g. `School of Computing` `AY2025/2026` (school text unchanged,
   badge appended alongside it via a flex row). This is the most visible
   spot — always on screen once a major is selected — and existing
   `flex-wrap` on the header already accommodates overflow on small
   screens.
2. **Settings → Programme section** (`StudyPlan.tsx`, `SettingsPage`):
   rendered under the major `<select>`. `SettingsPage` currently only
   receives `majors`/`majorId`, not the resolved `major` object — it
   derives `const major = majors.find((m) => m.id === majorId)` locally
   (same pattern `App.tsx` already uses for `pendingMajorLabel`), avoiding
   a new prop.

## Admin editing

`admin/src/components/MajorBuilder.tsx`, Info tab: a new `LabeledField`
"Batches (comma-separated)" alongside Label/School/Specialisation:

```tsx
<LabeledField label="Batches (comma-separated)">
  <input
    value={major.batches.join(', ')}
    onChange={(e) =>
      update({
        batches: e.target.value
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
      })
    }
    className={field}
    placeholder="e.g. AY2025/2026"
  />
</LabeledField>
```

Parses on every keystroke (consistent with how `RequirementsEditor`'s
`newCodes` field is comma-split elsewhere in this file), so an in-progress
trailing comma is harmless — it's filtered out by `.filter(Boolean)`.

## Error handling

- Empty `batches` array: `BatchBadge` renders nothing rather than an empty
  pill. Not expected in practice since data is populated for all 5 majors
  and the admin default is non-empty, but the component stays defensive
  since it's driven by hand-authored JSON.
- No validation on batch label format (e.g. no enforced `AYxxxx/yyyy`
  regex) — same permissive-string convention as `specialisation` and other
  free-text major fields.

## Testing

- **Manual (primary):** confirm the badge renders for all 5 current
  (single-batch) majors in both the header and Settings. Temporarily edit
  one major's `batches` array to 2–3 entries locally, confirm the
  multi-batch label renders correctly and the header doesn't visually
  break on a narrow (mobile) viewport before reverting the test edit.
  Verify the admin Info-tab field round-trips through Export (edit
  batches, export JSON, confirm the array is correct).

## Out of scope (YAGNI)

- Real historical batch-applicability research for the 4 non-CS majors or
  CS itself (separate future task, needs degree-audit-level sourcing).
- Structured range input (`{ from, to }`) in the admin UI — plain
  comma-separated text matches the rest of the admin's editing patterns.
- Surfacing the badge in the admin sidebar major list — admin scope here
  is limited to data entry (the Info tab field), per the settled design
  discussion.
