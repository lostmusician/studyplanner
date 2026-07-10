/**
 * Shared color literals for places that need an inline `style` value rather
 * than a Tailwind class (dynamic/conditional styling). Keep in sync with the
 * `muted` color in tailwind.config.js — this is the single source of truth
 * so a contrast fix doesn't need to be hand-copied across call sites again.
 */
export const MUTED = 'rgb(90, 89, 86)';

/**
 * Shared focus-visible ring for hover-reveal corner controls (module/waived
 * cards). Pair with a visibility class that also responds to
 * `group-focus-within`, not just `group-hover` — otherwise a keyboard user
 * tabbing onto the control lands on something invisible.
 */
export const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2';
