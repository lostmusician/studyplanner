# Profile Persistence & Plan Sharing — Design

Date: 2026-07-02

## Goal

1. Persist the student's **name and matric number** (and year) to localStorage so they survive reloads.
2. Add a **share** feature: generate a self-contained link that another person can open and import into their own copy of the app.

## Feature 1 — Persist profile

Currently `studentName`/`studentYear` live in `App.tsx` `useState` and are lost on reload. There is no matric number.

- New global localStorage key `studyplan:profile` holding `{ name, matricNumber, year }` (global, not per-major — it identifies the student).
- New hook `src/hooks/useProfile.ts` following the read/write-on-change pattern of `useStudyPlan`.
- Settings → Profile gains a **Matric Number** text input.
- Header shows matric number under the name.

## Feature 2 — Share via self-contained link

Backend-free. The whole payload rides in the URL hash.

### Encoding (`shared/share.ts`)

Payload:

```ts
interface SharePayload {
  v: 1;
  profile: { name: string; matricNumber: string; year: string };
  plan: { majorId: string; semesters: StudentSemester[]; waivedModules: WaivedModule[] };
}
```

- `encodePlan(payload): string` → JSON → UTF-8 → base64url.
- `decodePlan(string): SharePayload | null` → reverse; returns `null` on any parse/version failure.
- Link form: `<origin><pathname>#import=<encoded>`. Hash keeps data client-side and works on static hosting/SPA.

### Generate

- **Share** button in the header (beside Settings). Builds the link from the current profile + selected major's plan, writes it to the clipboard, and shows a transient "Link copied" confirmation.

### Import

- On load, `App` inspects `location.hash` for `#import=`.
- Valid payload → **preview modal**: "Import {name}'s plan for {Major} — N modules, M waived. This replaces your current {Major} plan." Confirm / Cancel.
  - Confirm: write profile to `studyplan:profile`; write the plan to `studyplan:{majorId}` via the existing normalize + `writeSavedPlan` logic; switch to that major and load it.
  - Cancel: no changes.
- Invalid / unknown major / corrupt → "Couldn't read this link" notice, no changes.
- The hash is cleared in all cases (`history.replaceState`) so a refresh doesn't re-trigger import.

### Validation

Decoding routes semesters/waived through the existing `normalizeSemesters` / `normalizeWaivedModules` guards so a malformed link cannot corrupt state. The `v` field lets us reject incompatible future formats.

## Out of scope (YAGNI)

No backend, no short links, no compression library, no multi-major bundling (share = currently selected major's plan).
