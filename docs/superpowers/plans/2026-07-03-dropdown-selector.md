# Custom Dropdown Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every native `<select>` in the app with a custom-styled dropdown on desktop (matching the canvas/paper/ink palette instead of the browser's own OS popup), while keeping the native picker unchanged on mobile.

**Architecture:** One new reusable `Dropdown` component (`src/components/Dropdown.tsx`) with two visual variants (`header`, `field`). It reads the existing `useIsMobile()` hook: on mobile it renders exactly today's native-`<select>` markup per variant; on desktop it renders a custom `<button>` trigger + animated `<ul role="listbox">` popover with click-outside/`Escape`/arrow-key/`Enter` handling and viewport-aware flip-up positioning. Six existing `<select>` call sites are swapped to use it with no change to their `onChange` handlers or data.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3.

## Global Constraints

- No new runtime dependencies (hand-rolled component, per the approved design).
- Mobile (`useIsMobile()` true, viewport ≤639px) rendering and behavior must be byte-for-byte unchanged from today for every replaced select.
- Theme tokens only: `canvas`, `paper`, `ink`, `muted`; radii `2xl`/`3xl`/`4xl`; `shadow-soft`. (from `tailwind.config.js`)
- Each replaced call site must keep its exact existing trigger visual styling (the same Tailwind class string it used as a native `<select>`/label), passed into `Dropdown` via a `className` prop — this plan only changes interaction/popover rendering, not each site's existing look.
- The major-switch confirmation dialog flow (`handleSwitchMajor` / `pendingMajorId` / `AppDialog` in `StudyPlan.tsx`) must keep working unmodified — `Dropdown` only calls the same `onChange` prop every replaced `<select>` already called.
- No test runner exists in this repo. Per-task gate = `npm run build` (runs `tsc --noEmit && vite build`) passing, plus manual verification with `npm run dev` at desktop width (≥640px) and mobile width (≤639px, via DevTools device mode).

## File Structure

- Modify: `tailwind.config.js` — add `dropdown-in`/`dropdown-out` keyframes + animation utilities.
- Create: `src/components/Dropdown.tsx` — the reusable dropdown component.
- Modify: `src/components/StudyPlan.tsx` — `MajorHeaderSelect` (header major picker) and `SettingsPage` (Year, Major selects).
- Modify: `src/components/AddModuleForm.tsx` — Year, Sem, Category selects.
- Modify: `src/components/SemesterGrid.tsx` — `SemesterAddModuleForm`'s Category select.
- Modify: `src/components/ModuleCard.tsx` — the inline category-edit select.

---

### Task 1: Tailwind open/close animation utilities

**Files:**
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: Tailwind utility classes `animate-dropdown-in`, `animate-dropdown-out`, consumed by Task 2.

- [ ] **Step 1: Add keyframes and animation entries**

In `tailwind.config.js`, inside `theme.extend`, add `keyframes` and `animation` alongside the existing `colors`/`boxShadow`/`borderRadius`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './admin/src/**/*.{ts,tsx}',
    './admin/index.html',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(239, 238, 231)',
        paper: 'rgb(225, 218, 205)',
        ink: 'rgb(20, 20, 19)',
        muted: 'rgb(108, 107, 104)',
      },
      boxShadow: {
        soft: '0 18px 40px rgba(20, 20, 19, 0.08)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      keyframes: {
        'dropdown-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'dropdown-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
      },
      animation: {
        'dropdown-in': 'dropdown-in 120ms ease-out',
        'dropdown-out': 'dropdown-out 100ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (config change only, nothing consumes the new utilities yet).

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "Add dropdown open/close animation utilities"
```

---

### Task 2: `Dropdown` component

**Files:**
- Create: `src/components/Dropdown.tsx`

**Interfaces:**
- Consumes: `useIsMobile` from `../hooks/useIsMobile` (existing hook, unchanged).
- Produces:
  ```ts
  export interface DropdownOption {
    value: string;
    label: string;
  }

  export const Dropdown: (props: {
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    variant: 'header' | 'field';
    ariaLabel: string;
    className?: string; // required in practice for variant="field"; ignored by variant="header"
  }) => JSX.Element
  ```

- [ ] **Step 1: Create the component**

```tsx
// src/components/Dropdown.tsx
import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  variant: 'header' | 'field';
  ariaLabel: string;
  className?: string;
}

const ESTIMATED_PANEL_HEIGHT = 280;

const ChevronIcon = ({ className }: { className: string }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export const Dropdown = ({ value, options, onChange, variant, ariaLabel, className }: Props) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.value === value);

  const requestClose = () => {
    if (!open) return;
    setClosing(true);
  };

  const selectOption = (option: DropdownOption) => {
    onChange(option.value);
    requestClose();
  };

  const handleToggle = () => {
    if (open) {
      requestClose();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < ESTIMATED_PANEL_HEIGHT && rect.top > spaceBelow);
    }
    setHighlightedIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        requestClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, options.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) selectOption(option);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlightedIndex, options]);

  if (isMobile) {
    if (variant === 'header') {
      return (
        <label className="relative block leading-tight">
          <span className="pointer-events-none flex items-center gap-1 pr-5 text-sm font-medium leading-tight text-ink">
            {selected?.label}
            <ChevronIcon className="h-3 w-3 text-ink/70" />
          </span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={ariaLabel}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {variant === 'header' ? (
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="flex cursor-pointer items-center gap-1 text-sm font-medium leading-tight text-ink"
        >
          {selected?.label}
          <ChevronIcon className={`h-3 w-3 text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronIcon className={`h-3 w-3 flex-shrink-0 text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <ul
          role="listbox"
          onAnimationEnd={() => {
            if (closing) {
              setOpen(false);
              setClosing(false);
            }
          }}
          className={`absolute z-40 left-0 max-h-64 min-w-full max-w-xs origin-top overflow-y-auto rounded-2xl border border-ink/10 bg-paper shadow-soft ${
            openUpward ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1'
          } ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
        >
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  option.value === value ? 'font-medium text-ink' : 'text-muted'
                } ${index === highlightedIndex ? 'bg-canvas' : 'hover:bg-canvas'}`}
              >
                {option.value === value && <span aria-hidden="true">✓</span>}
                <span className="truncate">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (component compiles; nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add src/components/Dropdown.tsx
git commit -m "Add reusable Dropdown component with mobile-native fallback"
```

---

### Task 3: Wire `Dropdown` into `StudyPlan.tsx` (header major picker + Settings selects)

**Files:**
- Modify: `src/components/StudyPlan.tsx:1-8` (imports), `:338-385` (`MajorHeaderSelect`), `:443-471` (`SettingsPage` Year + Major selects)

**Interfaces:**
- Consumes: `Dropdown`, `DropdownOption` from `./Dropdown` (Task 2).

- [ ] **Step 1: Import `Dropdown`**

In `src/components/StudyPlan.tsx`, add after the existing `AppDialog` import (line 8):

```tsx
import { Dropdown } from './Dropdown';
```

- [ ] **Step 2: Replace `MajorHeaderSelect`'s label+select with `Dropdown`**

Replace lines 338-385 (the whole `MajorHeaderSelect` component) with:

```tsx
const MajorHeaderSelect = ({
  majors,
  major,
  majorId,
  onChange,
}: {
  majors: Major[];
  major: Major;
  majorId: string;
  onChange: (id: string) => void;
}) => (
  <div className="flex flex-col items-start gap-0.5">
    <Dropdown
      variant="header"
      ariaLabel="Major"
      value={majorId}
      onChange={onChange}
      options={majors.map((item) => ({ value: item.id, label: item.label }))}
    />
    {major.specialisation && (
      <span className="text-xs leading-tight text-muted">{major.specialisation}</span>
    )}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] leading-tight text-muted/70">{major.school}</span>
      <BatchBadge batches={major.batches} />
    </div>
  </div>
);
```

- [ ] **Step 3: Replace the Settings Year select**

In `SettingsPage`, replace the Year `<select>` block (originally lines 445-453):

```tsx
              <Dropdown
                variant="field"
                ariaLabel="Year"
                value={studentYear}
                onChange={setStudentYear}
                className={field}
                options={[1, 2, 3, 4].map((year) => ({ value: `Year ${year}`, label: `Year ${year}` }))}
              />
```

(This sits inside the same `<label className="flex flex-col gap-1">...</label>` wrapper — only the `<select>` itself is replaced.)

- [ ] **Step 4: Replace the Settings Major select**

Replace the Major `<select>` block (originally lines 462-470):

```tsx
            <Dropdown
              variant="field"
              ariaLabel="Major"
              value={majorId}
              onChange={onSwitchMajor}
              className={field}
              options={majors.map((item) => ({ value: item.id, label: item.label }))}
            />
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Verify in preview**

Run `npm run dev`, open the printed URL at desktop width (≥1024px):
- Header major picker: click it, confirm a rounded/soft-shadow panel fades+scales in below the label, listing all majors with the current one checked; arrow keys move the highlight, `Enter` selects, clicking outside or `Escape` closes without changing anything.
- Settings → Programme: Year and Major selects open the same style of panel; selecting a different major still triggers the existing "Switch major" confirmation dialog before applying.

Resize to ≤639px (DevTools device mode): confirm the header picker and both Settings selects render as plain native selects, identical to before this change.

- [ ] **Step 7: Commit**

```bash
git add src/components/StudyPlan.tsx
git commit -m "Use Dropdown for header major picker and Settings selects"
```

---

### Task 4: Wire `Dropdown` into `AddModuleForm.tsx`

**Files:**
- Modify: `src/components/AddModuleForm.tsx:1` (imports), `:162-198` (Year, Sem, Category selects)

**Interfaces:**
- Consumes: `Dropdown` from `./Dropdown` (Task 2).

- [ ] **Step 1: Import `Dropdown`**

At the top of `src/components/AddModuleForm.tsx`, add after the existing imports (after line 4):

```tsx
import { Dropdown } from './Dropdown';
```

- [ ] **Step 2: Replace the Year, Sem, and Category selects**

Replace lines 162-198 (the `grid-cols-3` block's Year and Sem selects, plus the Category select below it) with:

```tsx
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted">Year</label>
          <Dropdown
            variant="field"
            ariaLabel="Year"
            value={form.year}
            onChange={(value) => setForm((f) => ({ ...f, year: value }))}
            className={field}
            options={[1, 2, 3, 4].map((y) => ({ value: String(y), label: `Y${y}` }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted">Sem</label>
          <Dropdown
            variant="field"
            ariaLabel="Semester"
            value={form.sem}
            onChange={(value) => setForm((f) => ({ ...f, sem: value }))}
            className={field}
            options={[
              { value: '1', label: 'S1' },
              { value: '2', label: 'S2' },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted">Category</label>
        <Dropdown
          variant="field"
          ariaLabel="Category"
          value={form.categoryId}
          onChange={(value) => setForm((f) => ({ ...f, categoryId: value }))}
          className={field}
          options={major.categories.map((cat) => ({ value: cat.id, label: cat.label }))}
        />
      </div>
```

Note the Year/Sem block keeps its enclosing `<div className="grid grid-cols-3 gap-2">` (still holding the MCs `<input>` before it) — only the two `<select>` elements inside it and the Category `<select>` below are replaced.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in preview**

At desktop width, open "Add Module": Year, Sem, and Category all open the custom panel, keyboard nav and click-outside work, selecting a value updates the form the same as before. At ≤639px, all three render as native selects.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddModuleForm.tsx
git commit -m "Use Dropdown for Add Module form's Year, Sem, and Category selects"
```

---

### Task 5: Wire `Dropdown` into `SemesterGrid.tsx`'s inline add-module form

**Files:**
- Modify: `src/components/SemesterGrid.tsx:1` (imports), `:462-471` (`SemesterAddModuleForm`'s Category select)

**Interfaces:**
- Consumes: `Dropdown` from `./Dropdown` (Task 2).

- [ ] **Step 1: Import `Dropdown`**

At the top of `src/components/SemesterGrid.tsx`, add after the existing `useIsMobile` import (after line 4):

```tsx
import { Dropdown } from './Dropdown';
```

- [ ] **Step 2: Replace the Category select**

In `SemesterAddModuleForm`, replace the `<select>` block (originally lines 462-471):

```tsx
      <Dropdown
        variant="field"
        ariaLabel="Category"
        value={form.categoryId}
        onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
        className="mt-2 w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        options={[
          { value: AUTO_CATEGORY, label: `Auto → ${inferredLabel}` },
          ...major.categories.map((cat) => ({ value: cat.id, label: cat.label })),
        ]}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in preview**

At desktop width, open a semester column's inline "add module" form: the Category dropdown shows "Auto → <label>" plus every category, opens the custom panel, and selecting a value updates `form.categoryId` (confirm by submitting and checking the placed module's bucket). At ≤639px it renders as a native select, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/SemesterGrid.tsx
git commit -m "Use Dropdown for semester inline add-module Category select"
```

---

### Task 6: Wire `Dropdown` into `ModuleCard.tsx`'s inline category editor

**Files:**
- Modify: `src/components/ModuleCard.tsx:1-9` (imports), `:234-243` (category-edit select)

**Interfaces:**
- Consumes: `Dropdown` from `./Dropdown` (Task 2).

- [ ] **Step 1: Import `Dropdown`**

At the top of `src/components/ModuleCard.tsx`, add after the existing `useIsMobile` import (after line 8):

```tsx
import { Dropdown } from './Dropdown';
```

- [ ] **Step 2: Replace the category-edit select**

Replace the `<select>` block (originally lines 234-243) with:

```tsx
          <Dropdown
            variant="field"
            ariaLabel={`Requirement bucket for ${module.code}`}
            value={editCategoryId}
            onChange={setEditCategoryId}
            className="w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            options={major.categories.map((cat) => ({ value: cat.id, label: cat.label }))}
          />
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in preview**

At desktop width, open a module card's inline editor (edit icon): the compact category dropdown opens the custom panel at the same small size/position, selecting a category updates `editCategoryId`, saving the edit still applies it. At ≤639px it renders as a native select, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/ModuleCard.tsx
git commit -m "Use Dropdown for module card's inline category editor"
```

---

## Self-Review

**Spec coverage:**
- Native `<select>` popup replaced with app-styled panel on desktop → Task 2 (`Dropdown` component). ✓
- Mobile keeps native picker unchanged → Task 2's `isMobile` branch, verified per usage-site task. ✓
- Subtle open/close animation → Task 1 (keyframes) + Task 2 (`animate-dropdown-in`/`-out`, `onAnimationEnd` unmount). ✓
- Click-outside / `Escape` / arrow-key / `Enter` interaction → Task 2. ✓
- Viewport-aware flip-up positioning → Task 2 (`openUpward` via `getBoundingClientRect`). ✓
- App-wide scope (every `<select>` in the app) → Tasks 3-6 cover `StudyPlan.tsx` (header + Settings ×2), `AddModuleForm.tsx` (×3), `SemesterGrid.tsx` (×1), `ModuleCard.tsx` (×1) — all six existing native selects found in the codebase. ✓
- Major-switch confirmation dialog untouched → Task 3 passes the same `onSwitchMajor`/`onChange` handlers through, no changes to `handleSwitchMajor`/`pendingMajorId`/`AppDialog`. ✓
- No new dependency → confirmed, Task 2 is hand-rolled. ✓

**Cross-task type consistency:**
- `DropdownOption { value: string; label: string }` and `Dropdown` props (`value`, `options`, `onChange`, `variant`, `ariaLabel`, `className`) defined once in Task 2, used identically in Tasks 3-6. ✓
- Every call site's `value`/`onChange` types are `string` (`majorId`, `studentYear`, `form.year`, `form.sem`, `form.categoryId`, `editCategoryId`) — matches `Dropdown`'s string-only contract. ✓
- `variant="field"` always paired with an explicit `className` (the site's pre-existing style string); `variant="header"` never passes `className` (unused in that branch). ✓
