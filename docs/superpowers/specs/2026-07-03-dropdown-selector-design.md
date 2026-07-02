# Custom Dropdown Selector — Design

**Date:** 2026-07-03
**Status:** Approved (pending spec review)

## Goal

Replace the app's native `<select>` elements with a custom-styled dropdown component
on desktop, so the open option list matches the app's visual language (canvas/paper/ink
palette, rounded corners, soft shadow) instead of the browser's own OS-rendered popup.
This is **visual/interaction polish only** — no changes to what options exist, what they
mean, or the app's data/switching logic.

## Problem

The major/specialisation picker in the header (`MajorHeaderSelect` in `StudyPlan.tsx:338-385`)
is a native `<select>` disguised as styled text: a `pointer-events-none` label (text +
chevron) sits under an invisible, absolutely-positioned, full-size `<select opacity-0>`
that captures clicks. This means the expanded option list is the browser's own OS-rendered
`<select>` popup — its appearance is 100% OS/browser-controlled and cannot be restyled
with CSS, which is why it looks inconsistent with the rest of the app.

Every other `<select>` in the app (Settings' Year/Major, `AddModuleForm`'s Year/Sem/Category,
`ModuleCard`'s category-edit) is a plain native `<select>` sharing a `field` Tailwind class
string, with the same OS-popup limitation.

The one existing precedent for a custom, fully-styleable dropdown in this codebase is
`ModuleCard.tsx`'s "Move" menu (lines 337-372): a toggle button
(`aria-haspopup="listbox" aria-expanded`) plus a manually-rendered `<ul role="listbox">`
popover.

## Decisions (from brainstorming)

- **Pain point:** visual polish only — not search/filter, not grouping/categorization.
- **Style direction:** propose options (not a specific reference to match, not a minimal
  tweak) — i.e. a real redesign of the open-panel visuals.
- **Scope:** app-wide — every `<select>` in the app gets the new component, for
  consistency, not just the header picker from the screenshot.
- **Interaction feel:** subtle animation on open/close.
- **Build approach:** hand-rolled component, no new dependency — mirrors the existing
  `ModuleCard` listbox pattern and keeps the project's zero-UI-library convention.
- **Mobile:** keep the native `<select>` picker on touch devices (≤639px, via the
  existing `useIsMobile()` hook) — the OS sheet is genuinely better touch UX than a
  reimplemented popover, so mobile behavior is unchanged.

## Approach

One new reusable component, `src/components/Dropdown.tsx`, with two visual variants
so it can replace both dropdown "looks" already in the app:

```ts
type DropdownOption = { value: string; label: string };

function Dropdown({
  value, options, onChange, variant, ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  variant: 'header' | 'field'; // 'header': text+chevron (major picker); 'field': bordered box (form/settings)
  ariaLabel: string;
}): JSX.Element
```

- **Mobile** (`useIsMobile()` true): renders today's exact markup — the invisible-overlay
  `<select>` trick for `variant="header"`, a plain `<select className={field}>` for
  `variant="field"`. No behavior change on phones.
- **Desktop** (`useIsMobile()` false): renders a custom trigger `<button>` +
  `<ul role="listbox">` popover, built from scratch (no headless library).

## Visual design

- **Trigger:** `header` variant keeps the current label + chevron look (no border);
  `field` variant keeps the current bordered-box `field` look. Chevron rotates 180°
  when open.
- **Panel:** `rounded-2xl bg-paper shadow-soft border border-ink/10`, absolutely
  positioned under the trigger, `max-h-64 overflow-y-auto`.
- **Options:** each an `<li><button>` row, `hover:bg-canvas`. The selected option is
  `font-medium text-ink` with a small check mark; others are `text-muted`.
- **Animation:** fade + scale-in (opacity 0→1, scale 95%→100%, ~120ms), anchored to
  the trigger's corner.
- **Positioning:** measured at open time — flips the panel above the trigger when
  there isn't enough room below (prevents clipping near the bottom of Settings or
  the Add Module form).

## Interaction

- Click outside or `Escape` closes the panel without changing the value.
- `ArrowUp` / `ArrowDown` moves a highlighted option; `Enter` selects the highlighted
  option and closes; clicking an option selects it directly.
- These behaviors are new code (the browser provided them for free with native
  `<select>`), kept intentionally small given the option lists involved are short
  (2 items for Sem, 4 for Year, a handful for Category, currently 5 for Major).

## Scope — replacement sites

Same `onChange` handlers as today in every case; only the rendering changes.

1. `MajorHeaderSelect` in `StudyPlan.tsx:338-385` (header picker) — `variant="header"`
2. `SettingsPage` in `StudyPlan.tsx`: Year select (~L445), Major select (~L462) —
   `variant="field"`
3. `AddModuleForm.tsx`: Year select (~L164), Sem select (~L176), Category select
   (~L189) — `variant="field"`
4. `ModuleCard.tsx`: category-edit select (~L234) — `variant="field"`

The existing "confirm dialog before switching major" logic
(`handleSwitchMajor` / `pendingMajorId` / `AppDialog` in `StudyPlan.tsx`) is untouched —
`Dropdown` calls the same `onChange` prop the native `<select>` called.

## Data flow

No changes to data, persistence, or major-switch confirmation logic. `Dropdown` is a
pure presentation/interaction wrapper around the same `value` / `options` / `onChange`
contract every replaced `<select>` already used.

## Error handling / edge cases

- Panel flips above the trigger when insufficient space below (measured at open time).
- Click-outside and `Escape` both close without firing `onChange`.
- `useIsMobile()` already defaults to `false` when `matchMedia` is unavailable
  (existing hook, unchanged) — desktop rendering is the safe fallback.
- Long option labels (e.g. "Business AI Systems (NUS College)") wrap or truncate
  within the panel's width rather than overflowing the viewport.

## Testing

- **Manual (primary):** no existing UI test harness in this repo. Verify in the
  running app at desktop width: each of the 6 replaced selects opens/closes, keyboard
  nav (arrows/Enter/Escape) and click-outside work, the panel flips up near the
  bottom of Settings/Add Module form, and the major-switch confirmation dialog still
  fires correctly through the new component.
- **Regression:** resize to ≤639px and confirm every replaced select still renders
  and behaves as the native picker (unchanged from today).

## Out of scope (YAGNI)

Search/filter within the dropdown, grouping/categorizing options, typeahead-by-letter,
changing what options exist or their labels, any change to mobile behavior.
