/** Top-level destinations rendered by the desktop sidebar and the compact
 * mobile bar. `advisor` and `settings` are utilities rather than pages, so
 * they are only part of the mobile set. */
export type AppDestination = 'home' | 'visualise' | 'explore';

export const APP_DESTINATION_LABELS: Record<AppDestination, string> = {
  home: 'Home',
  visualise: 'Visualise',
  explore: 'Explore',
};
