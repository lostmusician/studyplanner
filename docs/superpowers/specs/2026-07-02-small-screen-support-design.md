# Small-Screen Support — Design

**Date:** 2026-07-02
**Branch:** `enhancement/small-screen`
**Status:** Approved (pending spec review)

## Goal

Make the study planner usable and pleasant on phones so small-screen users get an
experience comparable to desktop. This is **responsive web design only** — no PWA,
no install, no offline, no native wrapper.

## Problems on small screens today

Observed at 375px width against the current `main`/branch build:

1. **Header overflows.** Identity block (name + matric), a vertical divider, and the
   major dropdown sit in one flex row on the left with fixed `min-w`, with Share /
   Settings on the right. Below ~400px the Settings button is clipped off the edge.
2. **Drag-and-drop fights scrolling.** `SemesterGrid` uses only a `PointerSensor`
   with a 6px activation distance. On touch, any attempt to scroll a column grabs a
   card instead.
3. **Card actions are hover-only.** Delete, ⓘ details, and edit-bucket buttons use
   `opacity-0 group-hover:opacity-100`, and the info tooltip is `onMouseEnter`. On
   touch there is no hover, so a phone user cannot delete a module, change its
   bucket, or open details.
4. **`touch-none` on each card** blocks vertical scrolling wherever a card sits,
   which also conflicts with a press-hold drag.
5. **Fixed 172px semester columns** in a horizontal scroll row are cramped and make
   dragging to an off-screen target impossible on a phone.

## Decisions (from brainstorming)

- **Move modules on touch:** *both* — press-hold to drag **and** a tap "move" menu.
- **Semester layout on narrow screens:** a **"choose which semester to display"**
  picker showing **one semester at a time** (not a swipe row, not a big vertical
  stack).
- **Move ⇄ button and card action buttons:** shown on **small screens only**; the
  desktop UI stays visually unchanged.

## Approach

Use Tailwind's `sm` breakpoint (640px) as the phone/desktop line.

- **Pure layout** (header, stat cards, padding) → Tailwind `sm:` classes, no JS.
- **Behavioral branches** (semester picker vs. row, drag sensors, always-visible
  card controls, the move menu) → a small `useIsMobile()` `matchMedia` hook.

Rejected alternative: CSS-only. It cannot swap the drag sensors, render the
semester picker, or conditionally mount the move menu, so JS awareness is required.

## Components

### 1. `useIsMobile()` hook (new, `src/hooks/`)

`matchMedia('(max-width: 639px)')` wrapper returning a boolean, subscribing to
changes and cleaning up on unmount. SSR-safe default of `false`. Single source of
truth for every behavioral branch below.

### 2. Header (`StudyPlan.tsx`)

Below `sm`:
- Remove the vertical divider and the fixed `min-w-[138px]`.
- Allow the bar to wrap: identity + major on the first row, Share / Settings
  right-aligned on the next.
- Tighten padding to `px-4 py-3` (from `px-6 py-5`).

At `sm`+ the header is unchanged.

### 3. Stats summary (`StatsSummary.tsx`)

Below `sm`:
- Cards go **2-up** — reduce card `min-w` so two fit per row (~44% width basis).
- Tighter padding (`px-4 py-3`).

Category detail panels already collapse to a single column (`sm:grid-cols-2`), so
they need no change.

### 4. Semester display (`SemesterGrid.tsx`)

At `sm`+ : **unchanged** — the existing horizontal scroll row of 172px columns.

Below `sm`:
- Render a **horizontally-scrollable chip selector**: `Waived · Y1S1 · Y1S2 · …`.
  Each chip shows its MC count and a small warning dot when that semester has a
  load warning. Selected chip is highlighted.
- Render **one full-width semester column** (the selected one) below the selector.
  The column drops its fixed 172px width and fills available width.
- Selected chip is component state, defaulting to the first semester. "Waived" is a
  selectable chip that shows the `WaivedCourses` panel full-width.

### 5. Move modules on touch (`SemesterGrid.tsx` + `ModuleCard.tsx`)

**Sensors** (`SemesterGrid`): replace the single `PointerSensor` with
- `MouseSensor` — `activationConstraint: { distance: 6 }` (desktop unchanged in feel).
- `TouchSensor` — `activationConstraint: { delay: 200, tolerance: 8 }` so a
  deliberate press-hold drags while a normal swipe scrolls.

**Card touch-action** (`ModuleCard`): replace `touch-none` with `touch-action: pan-y`
so vertical scrolling works over a card; the delay-based `TouchSensor` still allows
press-hold drag.

**Move menu** (`ModuleCard`, small screens only): a small **⇄ Move** control that
opens a menu listing every target semester. Selecting one calls the existing
`addOrMoveModule(year, sem, module)`. This is essential on mobile because only one
semester is visible at a time, so dragging to an off-screen target is often
impossible. The menu must respect the existing Year-1 26 MC cap check (reuse the
same guard path `SemesterGrid` uses on drop; show the same alert/error on
violation).

### 6. Card controls on touch (`ModuleCard.tsx`)

Below `sm`, make delete / ⓘ / edit-bucket **always visible** (drop the
`opacity-0 group-hover:opacity-100` gating on small screens). The hover tooltip is
mouse-only and is acceptably replaced by the ⓘ details modal on touch.

## Data flow

No changes to data or persistence. Every touch affordance funnels into existing
handlers: `addOrMoveModule`, `deleteModule`, `setModuleCategory`. The Y1-cap
guard (`canPlaceModule`) is reused by the move menu so validation stays consistent
with drag-and-drop.

## Error handling

- Move menu placement that would exceed the Y1 26 MC cap is rejected with the same
  message drag-and-drop shows today; no partial state change.
- `useIsMobile()` defaults to `false` when `matchMedia` is unavailable.

## Testing

- **Manual (primary):** DevTools device mode at 375px and a real phone via
  `npm run dev -- --host` for genuine touch. Verify: header does not clip;
  press-hold drags while swipe scrolls; move menu relocates a module and enforces
  the Y1 cap; delete / ⓘ / edit-bucket are tappable; semester picker switches the
  visible semester including Waived.
- **Regression:** at `sm`+ the desktop layout and interactions are byte-for-byte
  unchanged (no move button, hover-only actions intact, horizontal row intact).

## Out of scope (YAGNI)

PWA / installability, offline, service worker, gesture animations, landscape-specific
layouts, and any change to desktop visuals.
