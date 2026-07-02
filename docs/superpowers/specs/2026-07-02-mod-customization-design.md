# Mod Customization — Design

**Date:** 2026-07-02
**Branch:** `feat/mod-customization`
**Status:** Approved (pending spec review)

## Goal

Let users customize a placed module's course code, course name, and MC/unit count
after adding it to a semester — not just its requirement category, which is the
only thing editable today.

## Current state

- **Adding a mod** (`AddModuleForm.tsx`): the MC field is already a free-editable
  number input (defaults from NUSMods search or `4`), so no changes are needed here.
  Confirmed with the user this already meets the "editable unit numbers on add" ask.
- **Customizing after adding** (`ModuleCard.tsx:121-152`): a pencil icon opens a
  `<select>` that only changes `categoryId`, via `onChangeCategory` →
  `setModuleCategory(code, categoryId)` in `useStudyPlan.ts`. Code, name, and MCs
  are locked after placement.
- Modules are keyed by `code` throughout: drag id (`useDraggable({ id: module.code })`),
  requirement/prereq matching, `moduleCatalog` lookups, and de-duplication against
  `waivedModules`. Editing the code after placement is effectively a rename of the
  module's identity everywhere it's referenced, not a plain field mutation.

## Decisions (from brainstorming)

- Edit UI lives **inline on the card**, replacing the current category-only
  dropdown — not a separate modal.
- Editing the code is a **plain manual rename**: no NUSMods re-fetch/autocomplete
  on the card. Name and MCs are plain fields the user fully controls.
- If the edited code collides with another module already in the plan (placed or
  waived), the save is **blocked** with an inline error; state is not mutated.

## Components

### 1. Store layer — `useStudyPlan.ts`

Replace `setModuleCategory(moduleCode, categoryId)` with:

```ts
updateModule(
  oldCode: string,
  updates: { code: string; name: string; mcs: number; categoryId: string }
): { ok: true } | { ok: false; error: string }
```

Behavior:
- Normalize `updates.code` (trim, uppercase) and `updates.name` (falls back to the
  normalized code if blank). Parse `updates.mcs` as an int; fall back to the
  existing module's `mcs` if not a valid positive number.
- If the normalized code differs from `oldCode` and already exists elsewhere in
  `semesters` or in `waivedModules`, return `{ ok: false, error: 'Module already in your plan' }`
  and make no state change.
- Otherwise, replace the module matching `oldCode` in place within `semesters`
  (same year/sem slot) with the new `{ code, name, mcs, categoryId }`, and return
  `{ ok: true }`.

This function only touches `semesters` (placed modules). `waivedModules` is
unaffected — see Out of scope.

### 2. Prop threading — `StudyPlan.tsx` → `SemesterGrid.tsx` → `ModuleCard.tsx`

Rename the existing `setModuleCategory` / `onChangeCategory` prop chain to
`updateModule` / `onEditModule` with the new signature above. Mechanical change
across the three files; no other behavior in those files changes.

### 3. UI — `ModuleCard.tsx`

Replace the `editingCategory` boolean and lone `<select>` with an inline editor,
opened by the same pencil icon, containing:
- **Code** — text input, uppercased on blur.
- **Name** — text input.
- **MCs** — number input, `min="1" max="20"` (same constraints as the add form).
- **Category** — `<select>`, same options as today.
- **Save** / **Cancel** buttons.

On Save: call `onEditModule(module.code, { code, name, mcs, categoryId })`.
- If the result is `{ ok: false }`, show `error` inline under the form (e.g. below
  the Code field) and keep the editor open so the user can fix it.
- If `{ ok: true }`, close the editor.

Cancel discards in-progress edits without calling `onEditModule`.

## Data flow

`ModuleCard` → `onEditModule` → `SemesterGrid` (passthrough) → `StudyPlan` (passthrough)
→ `useStudyPlan.updateModule` → `setSemesters`. Persistence to `localStorage`
already happens automatically via the existing `useEffect` in `useStudyPlan.ts`
that fires on any `semesters` change — no new persistence code needed.

## Error handling

- Duplicate-code collision: blocked, inline error, no partial state change (see
  Decisions above).
- Empty code after trim: treated as invalid input; Save is a no-op with the same
  inline error path (reuse the "required" message rather than a separate case).
- Invalid/empty MCs: falls back to the module's current MC value rather than
  blocking save (consistent with how `normalizeModule` already treats invalid MCs
  elsewhere in the codebase).

## Testing

- **Manual (primary):** open a placed module's editor, change code/name/MCs/category
  independently and confirm each persists (survives a page reload, since the plan
  is localStorage-backed). Attempt to rename a module's code to match another
  placed module and confirm the save is blocked with an inline error and no state
  change. Cancel mid-edit and confirm no changes are applied.
- **Regression:** category-only edits (the existing behavior) still work end-to-end
  through the renamed `updateModule` path. Drag-and-drop, delete, and details modal
  on `ModuleCard` are unaffected.

## Out of scope (YAGNI)

- Waived module list (`WaivedCourses.tsx`) — this feature only touches modules
  placed in the semester grid.
- NUSMods re-fetch/autocomplete when editing code on the card (plain rename only,
  per brainstorming decision).
- Any change to the add-mod flow (`AddModuleForm.tsx`) — its MC field is already
  editable.
