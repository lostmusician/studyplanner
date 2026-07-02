# Mod Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user edit a placed module's course code, name, and MC count from the module card — not just its requirement category, which is the only field editable today.

**Architecture:** A pure `renameModule` transform in `src/lib/studyPlan.ts` (parallel to the existing `upsertModule`/`removeModule`) does the array update. `useStudyPlan.ts` gains an `updateModule(oldCode, updates)` hook method that normalizes input, blocks on a duplicate course code, and calls `renameModule`. That method threads through `StudyPlan.tsx` → `SemesterGrid.tsx` → `ModuleCard.tsx`, replacing the existing `setModuleCategory`/`onChangeCategory` chain. `ModuleCard.tsx`'s pencil-icon editor grows from a single category `<select>` into an inline form with Code/Name/MCs/Category fields plus Save/Cancel.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3.

## Global Constraints

- Editing course code is a **plain manual rename** — no NUSMods re-fetch/autocomplete on the card (spec decision).
- A code edit that collides with another module already in the plan (placed in any semester, or waived) is **blocked** with an inline error; no partial state change.
- Waived modules (`WaivedCourses.tsx`) are out of scope — only modules placed in the semester grid get this editor.
- No test runner exists in this repo. Per-task gate = `npm run build` (`tsc --noEmit && vite build`) passing, plus manual preview verification.
- Follow existing styling conventions: form fields use the `rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20` pattern already used for the category select; inline errors use `text-[10px] font-medium leading-snug text-red-700` (matches the Y1-cap error in `SemesterGrid.tsx:413`).

## File Structure

- Modify: `src/lib/studyPlan.ts` — add `renameModule` pure transform, alongside `upsertModule`/`removeModule`.
- Modify: `src/hooks/useStudyPlan.ts` — replace `setModuleCategory` with `updateModule`.
- Modify: `src/components/StudyPlan.tsx` — thread `updateModule` prop instead of `setModuleCategory`.
- Modify: `src/components/SemesterGrid.tsx` — thread `updateModule` through `Props`, `ColumnProps`, `SemesterColumn`, and the `ModuleCard` call site.
- Modify: `src/components/ModuleCard.tsx` — replace the category-only editor with a full inline Code/Name/MCs/Category editor.

---

### Task 1: `renameModule` pure transform

**Files:**
- Modify: `src/lib/studyPlan.ts:41-42` (insert after `removeModule`)

**Interfaces:**
- Produces: `renameModule(semesters: StudentSemester[], oldCode: string, updates: PlacedModule): StudentSemester[]` — replaces the module matching `oldCode` with `updates` in place (same semester slot, same array position), immutably.

- [ ] **Step 1: Add the function**

In `src/lib/studyPlan.ts`, immediately after `removeModule` (currently lines 41-42):

```ts
export const renameModule = (
  semesters: StudentSemester[],
  oldCode: string,
  updates: PlacedModule,
): StudentSemester[] =>
  semesters.map((s) => ({
    ...s,
    modules: s.modules.map((m) => (m.code === oldCode ? { ...updates } : m)),
  }));
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (no TS errors; `renameModule` compiles even though nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/studyPlan.ts
git commit -m "Add renameModule transform for editing placed modules"
```

---

### Task 2: `updateModule` hook method and prop threading

**Files:**
- Modify: `src/hooks/useStudyPlan.ts:3-12` (import), `:137-144` (replace `setModuleCategory`), `:188` (return key)
- Modify: `src/components/StudyPlan.tsx:19` (prop type), `:43` (destructure), `:159` (JSX prop)
- Modify: `src/components/SemesterGrid.tsx:23` (prop type), `:35` (destructure), `:132` and `:156` (JSX prop into `SemesterColumn`), `:188` (`ColumnProps`), `:196` (destructure), `:267` (JSX prop into `ModuleCard`)
- Modify: `src/components/ModuleCard.tsx:16` (prop type), `:29` (destructure), `:121-152` (call sites only — editor UI stays category-only in this task)

**Interfaces:**
- Consumes: `renameModule` from Task 1.
- Produces: `updateModule(oldCode: string, updates: { code: string; name: string; mcs: number; categoryId: string }): { ok: true } | { ok: false; error: string }`, threaded as a prop of the same signature down to `ModuleCard` as `onEditModule`. Task 3 relies on this exact signature.

- [ ] **Step 1: Replace `setModuleCategory` with `updateModule` in `useStudyPlan.ts`**

Add `renameModule` to the import block (currently lines 3-12):

```ts
import {
  createEmptySemesters,
  defaultPlanToSemesters,
  upsertModule,
  removeModule,
  renameModule,
  computeRequirements,
  computeStats,
  getCompletedCodesUpTo,
  autoCategoryId,
} from '../lib/studyPlan';
```

Replace the `setModuleCategory` callback (currently lines 137-144):

```ts
  const updateModule = useCallback(
    (
      oldCode: string,
      updates: { code: string; name: string; mcs: number; categoryId: string },
    ): { ok: true } | { ok: false; error: string } => {
      const code = updates.code.trim().toUpperCase();
      if (!code) return { ok: false, error: 'Course code is required.' };

      const existing = semesters.flatMap((s) => s.modules).find((m) => m.code === oldCode);
      const name = updates.name.trim() || code;
      const mcs = Number.isFinite(updates.mcs) && updates.mcs > 0 ? updates.mcs : existing?.mcs ?? 0;

      if (code !== oldCode) {
        const codeTaken =
          semesters.some((s) => s.modules.some((m) => m.code === code)) ||
          waivedModules.some((m) => m.code === code);
        if (codeTaken) return { ok: false, error: 'Module already in your plan.' };
      }

      setSemesters((prev) => renameModule(prev, oldCode, { code, name, mcs, categoryId: updates.categoryId }));
      return { ok: true };
    },
    [semesters, waivedModules],
  );
```

In the hook's return object (currently line 188), replace `setModuleCategory,` with `updateModule,`.

- [ ] **Step 2: Rename the prop in `StudyPlan.tsx`**

Prop type (currently line 19):

```ts
  updateModule: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
```

Destructure (currently line 43): replace `setModuleCategory,` with `updateModule,`.

JSX prop into `SemesterGrid` (currently line 159): replace `setModuleCategory={setModuleCategory}` with `updateModule={updateModule}`.

- [ ] **Step 3: Rename the prop through `SemesterGrid.tsx`**

Top-level `Props` interface (currently line 23):

```ts
  updateModule: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
```

Destructure in `SemesterGrid` (currently line 35): replace `setModuleCategory,` with `updateModule,`.

Both `SemesterColumn` JSX call sites (currently lines 132 and 156): replace `setModuleCategory={setModuleCategory}` with `updateModule={updateModule}`.

`ColumnProps` interface (currently line 188): same type change as `Props` above.

`SemesterColumn` destructure (currently line 196): replace `setModuleCategory` with `updateModule` in the parameter list.

`ModuleCard` JSX call site inside `SemesterColumn` (currently line 267): replace `onChangeCategory={setModuleCategory}` with `onEditModule={updateModule}`.

- [ ] **Step 4: Rename the prop and call sites in `ModuleCard.tsx` (UI unchanged)**

Prop type (currently line 16):

```ts
  onEditModule?: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
```

Destructure (currently line 29): replace `onChangeCategory,` with `onEditModule,`.

Pencil button (currently lines 121-131) — only the guard condition changes:

```tsx
      {!isOverlay && onEditModule && (
        <button
          className={`flex-shrink-0 text-ink/40 ${controlVisibility} transition-opacity hover:text-ink`}
          onClick={(e) => { e.stopPropagation(); setEditingCategory(true); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Edit bucket for ${module.code}`}
          title="Change requirement bucket"
        >
          <EditIcon className="h-3 w-3" />
        </button>
      )}
```

Category select (currently lines 137-152) — call `onEditModule` with a full updates object built from the module's current code/name/mcs plus the newly picked category, so behavior is unchanged from the user's point of view:

```tsx
      {!isOverlay && onEditModule && editingCategory && (
        <select
          autoFocus
          value={module.categoryId}
          onChange={(event) => {
            onEditModule(module.code, {
              code: module.code,
              name: module.name,
              mcs: module.mcs,
              categoryId: event.target.value,
            });
            setEditingCategory(false);
          }}
          onBlur={() => setEditingCategory(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
          aria-label={`Requirement bucket for ${module.code}`}
        >
          {major.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: PASS. (`App.tsx` spreads the hook's return value with `{...plan}` into `<StudyPlan>`, so the rename requires no change there — but a mismatch anywhere in the chain would surface as a missing-prop TS error here.)

- [ ] **Step 6: Verify in preview**

Start the dev server, place a module, click its pencil icon, change the category via the dropdown, and confirm the card updates and the category persists after a page reload. This should look and behave identically to before this task — only the underlying function changed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/studyPlan.ts src/hooks/useStudyPlan.ts src/components/StudyPlan.tsx src/components/SemesterGrid.tsx src/components/ModuleCard.tsx
git commit -m "Rename setModuleCategory to updateModule and thread it through"
```

---

### Task 3: Full inline Code/Name/MCs/Category editor

**Files:**
- Modify: `src/components/ModuleCard.tsx` (state at `:44`, editor JSX at `:121-152`)

**Interfaces:**
- Consumes: `onEditModule` from Task 2, same signature.

- [ ] **Step 1: Replace `editingCategory` state with full edit-form state**

Replace (currently line 44):

```tsx
  const [editingCategory, setEditingCategory] = useState(false);
```

with:

```tsx
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(module.code);
  const [editName, setEditName] = useState(module.name);
  const [editMcs, setEditMcs] = useState(String(module.mcs));
  const [editCategoryId, setEditCategoryId] = useState(module.categoryId);
  const [editError, setEditError] = useState<string | null>(null);
```

- [ ] **Step 2: Add `openEditor` and `handleSaveEdit` helpers**

Add just before the component's `return` statement:

```tsx
  const openEditor = () => {
    setEditCode(module.code);
    setEditName(module.name);
    setEditMcs(String(module.mcs));
    setEditCategoryId(module.categoryId);
    setEditError(null);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!onEditModule) return;
    const result = onEditModule(module.code, {
      code: editCode,
      name: editName,
      mcs: parseInt(editMcs, 10),
      categoryId: editCategoryId,
    });
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditing(false);
    setEditError(null);
  };
```

- [ ] **Step 3: Replace the pencil button to open the new editor**

Replace the pencil button block from Task 2:

```tsx
      {!isOverlay && onEditModule && (
        <button
          className={`flex-shrink-0 text-ink/40 ${controlVisibility} transition-opacity hover:text-ink`}
          onClick={(e) => { e.stopPropagation(); setEditingCategory(true); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Edit bucket for ${module.code}`}
          title="Change requirement bucket"
        >
          <EditIcon className="h-3 w-3" />
        </button>
      )}
```

with:

```tsx
      {!isOverlay && onEditModule && (
        <button
          className={`flex-shrink-0 text-ink/40 ${controlVisibility} transition-opacity hover:text-ink`}
          onClick={(e) => { e.stopPropagation(); openEditor(); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Edit ${module.code}`}
          title="Edit module"
        >
          <EditIcon className="h-3 w-3" />
        </button>
      )}
```

- [ ] **Step 4: Replace the category-only select with the full editor**

Replace the select block from Task 2:

```tsx
      {!isOverlay && onEditModule && editingCategory && (
        <select
          autoFocus
          value={module.categoryId}
          onChange={(event) => {
            onEditModule(module.code, {
              code: module.code,
              name: module.name,
              mcs: module.mcs,
              categoryId: event.target.value,
            });
            setEditingCategory(false);
          }}
          onBlur={() => setEditingCategory(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
          aria-label={`Requirement bucket for ${module.code}`}
        >
          {major.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      )}
```

with:

```tsx
      {!isOverlay && onEditModule && editing && (
        <div
          className="mt-1.5 flex flex-col gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            placeholder="Code"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`Course code for ${module.code}`}
          />
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`Course name for ${module.code}`}
          />
          <input
            type="number"
            min="1"
            max="20"
            value={editMcs}
            onChange={(e) => setEditMcs(e.target.value)}
            placeholder="MCs"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`MCs for ${module.code}`}
          />
          <select
            value={editCategoryId}
            onChange={(e) => setEditCategoryId(e.target.value)}
            className="w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`Requirement bucket for ${module.code}`}
          >
            {major.categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          {editError && (
            <p className="text-[10px] font-medium leading-snug text-red-700">{editError}</p>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex-1 rounded-lg bg-ink py-1 text-[10px] font-medium text-canvas"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditError(null); }}
              className="flex-1 rounded-lg bg-ink/10 py-1 text-[10px] font-medium text-ink/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Verify in preview**

Start the dev server and, against a placed module:
1. Click the pencil icon — confirm the editor shows the current code, name, MCs, and category pre-filled.
2. Change only the MCs value, click Save — confirm the card's MC display updates and the change survives a page reload.
3. Change the code to one already used by another placed module, click Save — confirm an inline red error appears (`Module already in your plan.`) and the card is *not* renamed.
4. Change the code to a brand-new value along with the name, click Save — confirm the card now shows the new code/name, and dragging/deleting/details (ⓘ) still work on the renamed card.
5. Open the editor, change a field, click Cancel — confirm the card is unchanged.
6. Regression: category-only edits (Task 2's path) still work; delete and course-detail (ⓘ) buttons on other cards are unaffected; drag-and-drop still works.

- [ ] **Step 7: Commit**

```bash
git add src/components/ModuleCard.tsx
git commit -m "Add inline code/name/MCs editor to placed module cards"
```
