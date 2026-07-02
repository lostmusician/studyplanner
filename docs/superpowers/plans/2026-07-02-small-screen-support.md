# Small-Screen Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the study planner usable on phones — responsive header/stats, a one-at-a-time semester picker, and touch-friendly module moving — without changing the desktop experience.

**Architecture:** Tailwind `sm:` (640px) classes handle pure layout. A `useIsMobile()` `matchMedia` hook (`max-width: 639px`) drives the three behavioral branches: dual drag sensors, always-visible card controls + a move menu, and the mobile semester picker.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, `@dnd-kit/core`.

## Global Constraints

- Breakpoint: phone is `max-width: 639px`; Tailwind `sm` (`min-width: 640px`) is desktop. One source of truth for JS: `useIsMobile()`.
- Desktop (`sm`+) output must be visually and behaviorally unchanged. No move button, hover-only card actions intact, 172px horizontal semester row intact.
- No new runtime dependencies. No PWA/offline/service-worker.
- Theme tokens only: `canvas`, `paper`, `ink`, `muted`; radii `2xl/3xl/4xl`; `shadow-soft`. (from `tailwind.config.js`)
- Year-1 semesters cannot exceed 26 MC (`YEAR_ONE_MAX_MCS`); every module placement path must enforce it via the existing `canPlaceModule` check.
- No test runner exists. Per-task gate = `npm run build` (runs `tsc --noEmit && vite build`) passing, plus manual preview verification at 375px and ≥640px.

## File Structure

- Create: `src/hooks/useIsMobile.ts` — media-query boolean hook.
- Modify: `src/components/StudyPlan.tsx` — responsive header.
- Modify: `src/components/StatsSummary.tsx` — 2-up cards on mobile.
- Modify: `src/components/ModuleCard.tsx` — touch-action, mobile-visible controls, move menu.
- Modify: `src/components/SemesterGrid.tsx` — dual sensors, centralized move handler, mobile semester picker, full-width column.
- Modify: `src/components/WaivedCourses.tsx` — accept a `fullWidth` prop so it fills width on mobile.

---

### Task 1: `useIsMobile` hook

**Files:**
- Create: `src/hooks/useIsMobile.ts`

**Interfaces:**
- Produces: `useIsMobile(): boolean` — `true` when viewport width ≤ 639px.

- [ ] **Step 1: Create the hook**

```ts
// src/hooks/useIsMobile.ts
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)';

/** True when the viewport is phone-sized (≤ 639px). SSR-safe (defaults to false). */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(QUERY);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (no TS errors; `useIsMobile.ts` compiles even though nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useIsMobile.ts
git commit -m "Add useIsMobile media-query hook"
```

---

### Task 2: Responsive header

**Files:**
- Modify: `src/components/StudyPlan.tsx:87-122`

**Interfaces:**
- Consumes: nothing new (pure Tailwind classes).

- [ ] **Step 1: Make the header wrap and shrink on mobile**

In `src/components/StudyPlan.tsx`, update the `<header>` and its inner clusters.

Change the header padding (line 87):

```tsx
<header className="px-4 py-3 sm:px-6 sm:py-5" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
```

Change the outer row (line 88) to allow wrapping:

```tsx
<div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
```

Change the left cluster (line 89):

```tsx
<div className="flex items-center gap-3 sm:gap-6">
```

Relax the fixed name width (line 90):

```tsx
<div className="flex flex-col gap-0.5 sm:min-w-[138px]">
```

Hide the divider on mobile (line 97):

```tsx
<div className="hidden sm:block h-10 w-px" style={{ backgroundColor: 'rgba(20,20,19,0.1)' }} />
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Verify in preview**

Start `student-app-preview` (port 5176). Screenshot at mobile (375px): the "Settings" button is fully visible (not clipped); header content wraps cleanly. Screenshot at desktop (1280px): header looks identical to before (divider present, single row).

- [ ] **Step 4: Commit**

```bash
git add src/components/StudyPlan.tsx
git commit -m "Make planner header responsive on small screens"
```

---

### Task 3: Responsive stat cards (2-up on mobile)

**Files:**
- Modify: `src/components/StatsSummary.tsx:69` (TotalStatCard), `:105` (StatCard)

**Interfaces:**
- Consumes: nothing new (pure Tailwind classes).

- [ ] **Step 1: Make TotalStatCard 2-up on mobile**

`src/components/StatsSummary.tsx` line 69, replace the className:

```tsx
      className="flex min-w-0 grow basis-[calc(50%-0.375rem)] flex-col gap-1.5 rounded-3xl bg-white px-4 py-3 text-left shadow-soft sm:grow-0 sm:basis-auto sm:min-w-[160px] sm:px-5 sm:py-4"
```

- [ ] **Step 2: Make StatCard 2-up on mobile**

`src/components/StatsSummary.tsx` line 105, replace the `className` constant:

```tsx
  const className =
    'flex min-w-0 grow basis-[calc(50%-0.375rem)] flex-col gap-1.5 rounded-3xl px-4 py-3 text-left transition sm:grow-0 sm:basis-auto sm:min-w-[140px] sm:px-5 sm:py-4';
```

(The `flex flex-wrap gap-3` container at line 24 is unchanged — `basis-[calc(50%-0.375rem)]` accounts for the 0.75rem gap so exactly two cards fit per row on mobile.)

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in preview**

Screenshot at 375px: stat cards sit two per row with tighter padding. Screenshot at 1280px: cards are their original width (min 140/160px) in a single wrapped row — unchanged from before.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsSummary.tsx
git commit -m "Lay out stat cards two-up on small screens"
```

---

### Task 4: Card touch-action + mobile-visible controls

**Files:**
- Modify: `src/components/ModuleCard.tsx`

**Interfaces:**
- Consumes: `useIsMobile` from `../hooks/useIsMobile`.

- [ ] **Step 1: Import the hook and read it**

At the top of `src/components/ModuleCard.tsx`, add the import (after line 6):

```tsx
import { useIsMobile } from '../hooks/useIsMobile';
```

Inside the component body, after the `cardRef` declaration (line 41), add:

```tsx
  const isMobile = useIsMobile();
```

- [ ] **Step 2: Replace `touch-none` so vertical scroll works on touch**

Line 76, change the root `className` from `... select-none touch-none` to:

```tsx
      className="relative group rounded-2xl p-3 select-none"
      style={{ ...style, touchAction: 'pan-y' }}
```

Note: `style` is already spread onto the element at line 75 as `style={style}`. Replace that single `style={style}` usage — the element must end up with both the existing `style` object and `touchAction: 'pan-y'`. Concretely, delete the `style={style}` attribute at line 75 and use the combined form shown above.

- [ ] **Step 3: Show delete / details / edit-bucket without hover on mobile**

Define a visibility helper just before the `return` (near line 68):

```tsx
  // On touch there is no hover, so reveal the card controls unconditionally.
  const controlVisibility = isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
```

Then replace `opacity-0 transition-opacity group-hover:opacity-100` with `${controlVisibility} transition-opacity` in these three places:
- edit-bucket button (line 111): `className={\`flex-shrink-0 text-ink/40 ${controlVisibility} transition-opacity hover:text-ink\`}`
- delete button (line 145): `className={\`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-canvas ${controlVisibility} transition-opacity\`}`
- details (ⓘ) button (line 157): `className={\`absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-serif italic text-canvas ${controlVisibility} transition-opacity\`}`

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Verify in preview**

Screenshot at 375px: the ⓘ (top-left), × (top-right), and edit-bucket (pencil) controls are visible on every card without hovering. Screenshot at 1280px: controls are hidden until hover (unchanged). Confirm a card can be vertically scrolled past on touch emulation (drag over a card scrolls the page).

- [ ] **Step 6: Commit**

```bash
git add src/components/ModuleCard.tsx
git commit -m "Reveal module card controls on touch and allow vertical scroll"
```

---

### Task 5: Dual drag sensors + centralized move handler

**Files:**
- Modify: `src/components/SemesterGrid.tsx`

**Interfaces:**
- Produces (passed down to `SemesterColumn` → `ModuleCard`):
  - `isMobile: boolean`
  - `moveTargets: { year: number; sem: number; label: string }[]` — all semesters, in order.
  - `onMove: (module: PlacedModule, year: number, sem: number) => void` — validates the Y1 cap then places; alerts on violation.

- [ ] **Step 1: Swap `PointerSensor` for `MouseSensor` + `TouchSensor`**

In `src/components/SemesterGrid.tsx`, update the dnd-kit import (line 2):

```tsx
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
```

Replace the `sensors` definition (lines 41-43):

```tsx
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold to drag on touch, so a normal swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
```

- [ ] **Step 2: Extract a shared `moveModule` handler and reuse it in drag-end**

Add near the top of the component body (after line 39, `const [activeDrag...]`):

```tsx
  const moveModule = (module: PlacedModule, year: number, sem: number) => {
    const target = semesters.find((s) => s.year === year && s.sem === sem);
    if (!target) return;
    if (!canPlaceModule(target, module)) {
      alert('Year 1 semesters cannot exceed 26 MC.');
      return;
    }
    addOrMoveModule(year, sem, module);
  };
```

Replace the body of `handleDragEnd` (lines 50-63) so it delegates to `moveModule`:

```tsx
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const module = active.data.current?.module as PlacedModule;
    const [year, sem] = (over.id as string).split('-').map(Number);
    moveModule(module, year, sem);
  };
```

- [ ] **Step 3: Build `moveTargets` and thread new props to `SemesterColumn`**

Import the hook (after line 10):

```tsx
import { useIsMobile } from '../hooks/useIsMobile';
```

In the component body add:

```tsx
  const isMobile = useIsMobile();
  const moveTargets = semesters.map((s) => ({
    year: s.year,
    sem: s.sem,
    label: semesterLabel(s.year, s.sem),
  }));
```

Pass them into each `SemesterColumn` (the `.map` at lines 76-86):

```tsx
        {semesters.map((semester) => (
          <SemesterColumn
            key={`${semester.year}-${semester.sem}`}
            semester={semester}
            major={major}
            addOrMoveModule={addOrMoveModule}
            deleteModule={deleteModule}
            setModuleCategory={setModuleCategory}
            completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(semester.year, semester.sem)]))}
            isMobile={isMobile}
            moveTargets={moveTargets}
            onMoveModule={moveModule}
          />
        ))}
```

Extend `ColumnProps` (lines 106-113) with:

```tsx
  isMobile: boolean;
  moveTargets: { year: number; sem: number; label: string }[];
  onMoveModule: (module: PlacedModule, year: number, sem: number) => void;
```

Destructure them in `SemesterColumn` (line 115) and pass to each `ModuleCard` (lines 177-188):

```tsx
        {semester.modules.map((module) => (
          <ModuleCard
            key={module.code}
            module={module}
            major={major}
            completedCodes={completedCodes}
            fromYear={semester.year}
            fromSem={semester.sem}
            onDelete={deleteModule}
            onChangeCategory={setModuleCategory}
            isMobile={isMobile}
            moveTargets={moveTargets}
            onMove={(year, sem) => onMoveModule(module, year, sem)}
          />
        ))}
```

(The `ModuleCard` props `isMobile`, `moveTargets`, `onMove` are added in Task 6. Until then TypeScript will error on the two unknown props — that is expected; Task 6 closes it. If executing tasks strictly one commit at a time, do Steps 1-2 here, then Task 6, then return for Step 3. If executing 5+6 together, apply both before typechecking.)

- [ ] **Step 4: Typecheck (after Task 6 is also applied)**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Verify desktop drag still works**

At 1280px: dragging a card between columns still moves it; Y1 over-cap still alerts. (Mouse sensor, distance 6 — unchanged feel.)

- [ ] **Step 6: Commit (jointly with Task 6)**

```bash
git add src/components/SemesterGrid.tsx src/components/ModuleCard.tsx
git commit -m "Add touch drag sensor and centralized module move handler"
```

---

### Task 6: Move ⇄ menu on module cards (mobile only)

**Files:**
- Modify: `src/components/ModuleCard.tsx`

**Interfaces:**
- Consumes: `isMobile`, `moveTargets`, `onMove` (from Task 5).
- `onMove: (year: number, sem: number) => void`.

- [ ] **Step 1: Extend `Props`**

In `src/components/ModuleCard.tsx`, add to the `Props` interface (lines 8-17):

```tsx
  isMobile?: boolean;
  moveTargets?: { year: number; sem: number; label: string }[];
  onMove?: (year: number, sem: number) => void;
```

Destructure them in the component signature (lines 19-28), with defaults:

```tsx
  isMobile = false,
  moveTargets = [],
  onMove,
```

- [ ] **Step 2: Add menu state**

After the `isMobile` line added in Task 4 (near line 41), add:

```tsx
  const [showMoveMenu, setShowMoveMenu] = useState(false);
```

- [ ] **Step 3: Render the move control + menu (mobile, non-overlay only)**

Insert this block just before the closing `</div>` of the card root (after the Course details block, ~line 197). It excludes the card's current semester from the target list:

```tsx
      {/* Move menu — touch-friendly alternative to dragging */}
      {!isOverlay && isMobile && onMove && moveTargets.length > 0 && (
        <div className="relative mt-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMoveMenu((open) => !open); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex w-full items-center justify-center gap-1 rounded-xl bg-ink/10 px-2 py-1 text-[10px] font-medium text-ink/70"
            aria-haspopup="listbox"
            aria-expanded={showMoveMenu}
          >
            ⇄ Move
          </button>
          {showMoveMenu && (
            <ul className="absolute z-40 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-2xl bg-ink shadow-soft" role="listbox">
              {moveTargets
                .filter((target) => !(target.year === fromYear && target.sem === fromSem))
                .map((target) => (
                  <li key={`${target.year}-${target.sem}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-xs text-canvas hover:bg-canvas/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(target.year, target.sem);
                        setShowMoveMenu(false);
                      }}
                    >
                      {target.label}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: PASS (this closes the props gap from Task 5).

- [ ] **Step 5: Verify in preview**

At 375px: each card shows a "⇄ Move" button; tapping opens a list of the other semesters; choosing one moves the module (visible after switching to that semester via the picker in Task 7 — or, before Task 7, by resizing to desktop to confirm it landed). Moving into a full Y1 semester triggers the 26 MC alert and does not move. At 1280px: no Move button appears.

- [ ] **Step 6: Commit**

See Task 5 Step 6 (committed jointly).

---

### Task 7: Mobile semester picker + full-width column

**Files:**
- Modify: `src/components/SemesterGrid.tsx`
- Modify: `src/components/WaivedCourses.tsx`

**Interfaces:**
- Consumes: `isMobile` (already in `SemesterGrid` from Task 5).
- `WaivedCourses` gains `fullWidth?: boolean`.
- `SemesterColumn` gains `fullWidth?: boolean`.

- [ ] **Step 1: Let `WaivedCourses` fill width**

In `src/components/WaivedCourses.tsx`, add `fullWidth?: boolean` to `Props` (lines 7-12):

```tsx
  fullWidth?: boolean;
```

Destructure it (line 21): `export const WaivedCourses = ({ major, waivedModules, onAdd, onDelete, fullWidth = false }: Props) => {`

Replace the fixed width style (lines 104-110):

```tsx
      className="flex flex-col flex-shrink-0 rounded-3xl p-3"
      style={{
        minWidth: fullWidth ? undefined : '172px',
        width: fullWidth ? '100%' : '172px',
        minHeight: '280px',
        backgroundColor: 'rgb(225,218,205)',
      }}
```

- [ ] **Step 2: Let `SemesterColumn` fill width**

In `src/components/SemesterGrid.tsx`, add `fullWidth?: boolean` to `ColumnProps` and destructure it (default `false`). Replace the fixed width style (lines 127-135) so width is conditional:

```tsx
      className="flex flex-col flex-shrink-0 rounded-3xl p-3 transition-colors"
      style={{
        minWidth: fullWidth ? undefined : '172px',
        width: fullWidth ? '100%' : '172px',
        minHeight: '280px',
        backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)',
        outline: isOver ? '2px dashed rgb(108,107,104)' : 'none',
        outlineOffset: '-2px',
      }}
```

- [ ] **Step 3: Add picker state and render branch**

In `SemesterGrid`, add state (after `isMobile` from Task 5):

```tsx
  // Mobile shows one semester at a time; 'waived' selects the waived panel.
  const [selectedKey, setSelectedKey] = useState<string>(
    semesters[0] ? `${semesters[0].year}-${semesters[0].sem}` : 'waived',
  );
```

Add a helper above the JSX return that lists chip descriptors (reusing existing `getSemesterMcs` and `getLoadWarning`):

```tsx
  const chips = [
    { key: 'waived', label: 'Waived', warn: false },
    ...semesters.map((s) => {
      const mcs = getSemesterMcs(s);
      return {
        key: `${s.year}-${s.sem}`,
        label: `${semesterLabel(s.year, s.sem)} · ${mcs} MC`,
        warn: Boolean(getLoadWarning(s.year, mcs)),
      };
    }),
  ];
  const selectedSemester = semesters.find((s) => `${s.year}-${s.sem}` === selectedKey) ?? null;
```

Replace the row container (lines 69-87) with a branch. Keep the existing desktop row for `!isMobile`; render picker + single column for mobile:

```tsx
      {isMobile ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setSelectedKey(chip.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedKey === chip.key ? 'bg-ink text-canvas' : 'bg-paper text-ink/70'
                }`}
              >
                {chip.label}
                {chip.warn && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
              </button>
            ))}
          </div>

          {selectedKey === 'waived' ? (
            <WaivedCourses
              major={major}
              waivedModules={waivedModules}
              onAdd={addWaivedModule}
              onDelete={deleteWaivedModule}
              fullWidth
            />
          ) : selectedSemester ? (
            <SemesterColumn
              key={selectedKey}
              semester={selectedSemester}
              major={major}
              addOrMoveModule={addOrMoveModule}
              deleteModule={deleteModule}
              setModuleCategory={setModuleCategory}
              completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(selectedSemester.year, selectedSemester.sem)]))}
              isMobile={isMobile}
              moveTargets={moveTargets}
              onMoveModule={moveModule}
              fullWidth
            />
          ) : null}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          <WaivedCourses
            major={major}
            waivedModules={waivedModules}
            onAdd={addWaivedModule}
            onDelete={deleteWaivedModule}
          />
          {semesters.map((semester) => (
            <SemesterColumn
              key={`${semester.year}-${semester.sem}`}
              semester={semester}
              major={major}
              addOrMoveModule={addOrMoveModule}
              deleteModule={deleteModule}
              setModuleCategory={setModuleCategory}
              completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(semester.year, semester.sem)]))}
              isMobile={isMobile}
              moveTargets={moveTargets}
              onMoveModule={moveModule}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Verify in preview**

At 375px: a chip row (`Waived · Y1S1 · Y1S2 · …`) is shown; the selected chip is dark; exactly one full-width semester (or the Waived panel) shows below; chips with a load warning show an orange dot; tapping a chip switches the visible semester; the move menu (Task 6) can relocate a module and switching chips confirms it landed. At 1280px: the original horizontal 172px row is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/SemesterGrid.tsx src/components/WaivedCourses.tsx
git commit -m "Add mobile semester picker showing one full-width semester"
```

---

## Self-Review

**Spec coverage:**
- Header responsive → Task 2. ✓
- Stats 2-up → Task 3. ✓
- Semester picker, one at a time, Waived as a chip, full-width column → Task 7. ✓
- Dual sensors (Mouse + delayed Touch), `touch-action: pan-y` → Tasks 5 & 4. ✓
- Move menu, mobile-only, reuses Y1 cap check → Tasks 5 (`moveModule`) & 6. ✓
- Card controls always visible on mobile → Task 4. ✓
- `useIsMobile()` hook, `sm`/640px line → Task 1. ✓
- Desktop unchanged → guaranteed by `isMobile`/`sm:` gating; verified each task at 1280px. ✓

**Cross-task type consistency:**
- `moveTargets: { year; sem; label }[]` — same shape in Tasks 5, 6, 7. ✓
- `onMoveModule(module, year, sem)` in `SemesterGrid`/`SemesterColumn`; `ModuleCard.onMove(year, sem)` is the curried form. ✓
- `fullWidth?: boolean` on `WaivedCourses` and `SemesterColumn` — Task 7. ✓

**Note on Tasks 5 + 6:** they cross-reference each other's props and must be applied together before the first `npm run build` passes; they share one commit.
