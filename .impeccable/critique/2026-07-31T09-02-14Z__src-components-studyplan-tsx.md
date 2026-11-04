---
target: src/components/StudyPlan.tsx
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-07-31T09-02-14Z
slug: src-components-studyplan-tsx
---
Method: degraded (no sub-agent tool exposed)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good feedback on MC totals and warnings, though status updates rely purely on client-side actions. |
| 2 | Match System / Real World | 4 | Excellent match; terms like MC, Y1S1, and NUSC are native to target users. |
| 3 | User Control and Freedom | 4 | Undo notification on delete and simple escape routes exist. |
| 4 | Consistency and Standards | 3 | Corner radiuses on buttons vary slightly (rounded-full, rounded-2xl). |
| 5 | Error Prevention | 4 | Proactive prerequisite validation and credit limits prevent invalid layouts. |
| 6 | Recognition Rather Than Recall | 4 | Checklist sidebar and module lookup reduce memory load. |
| 7 | Flexibility and Efficiency | 2 | Good drag-and-drop, but lacks keyboard shortcuts or accelerators for rapid edits. |
| 8 | Aesthetic and Minimalist Design | 3 | Color density is high and can feel flatly colored (AI-template pastel look). |
| 9 | Error Recovery | 3 | Clear text prompts on violations, though lacks direct module replacement advice. |
| 10 | Help and Documentation | 2 | Contextual cues exist, but no dedicated help manual. |
| **Total** | | **32/40** | **Good** |

### Design Specificity Verdict

**Design Specificity**: The design is tailored to the academic domain of NUS computing/college students. The checklist structure directly supports SoC graduation rules. However, the visual identity (solid pastel colors, generic round button shapes) lacks a premium branded feel, making the layout feel like a standard drag-and-drop template.

**Deterministic Scan**:
- The automated linter detected a design-system font-size mismatch:
  - `src/components/StudyPlan.tsx` (line 514): Literal `11px` is off the DESIGN.md typography scale.
- Across the wider components under `src/components/`, several occurrences of `11px` are used which are not part of the standard design token scale.

**Visual Overlays**:
- Not injected this session (running in degraded static mode).

### Overall Impression
ModStack is highly functional and has solid usability, but visually it feels like a default boilerplate. The highest leverage opportunity is transforming the layout from flat colored boxes to a polished, premium editorial aesthetic (e.g. outline cards, vertical accent markers, desaturated warning boxes).

### What's Working
- **Prerequisite Checking**: Integrating the NUSMods API dynamically to flag prerequisite errors is exceptionally helpful and well-communicated.
- **Requirement Sidebar**: Having the checklist scroll side-by-side with the semester grid makes progress immediately visible.

### Priority Issues
- **[P1] Visual Accent Fatigue**
  - *Why it matters*: Painting entire module cards with pastel background colors makes the page look flat, busy, and visually repetitive.
  - *Fix*: Use a white card background with a thin vertical left border colored by the category to represent tags.
  - *Suggested command*: `/impeccable layout`
- **[P1] Generic Button Aesthetics**
  - *Why it matters*: Rounded-full or plain rounded-2xl solid black buttons look default and lack custom micro-interactions.
  - *Fix*: Adopt rounded-xl borders, subtle shadows, and translate-y hover effects.
  - *Suggested command*: `/impeccable bolder`
- **[P2] Jarrish Alert Banners**
  - *Why it matters*: Saturated sky-100 and orange-100 background warnings feel clinical.
  - *Fix*: Desaturate warning backgrounds, add custom slate borders and status dots.
  - *Suggested command*: `/impeccable quieter`
- **[P2] Lack of Keyboard Accelerators**
  - *Why it matters*: Power users planning multiple semesters must use drag-and-drop exclusively, making bulk operations tedious.
  - *Fix*: Support keybindings (like pressing Delete to remove selected module).
  - *Suggested command*: `/impeccable adapt`

### Persona Red Flags
- **Alex (Power User)**: Forced to drag and drop every single course; no shortcut keybinds or batch addition methods.
- **Jordan (First-Timer)**: Empty state prompt is plain text. The onboarding modal is unskippable when visiting first-time.
- **Sam (Accessibility)**: Screen reader announcements for prerequisite errors aren't fully configured with ARIA live region updates.

### Minor Observations
- Active view states (Planner vs Settings) toggles are plain and don't visually stand out in the header.

### Questions to Consider
- What would a confident, premium version of this look like?
- Can we make the double/triple-counted indicators more prominent?
