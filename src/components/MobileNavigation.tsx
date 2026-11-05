import type { AppDestination } from '../lib/navigation';

export type MobileDestination = AppDestination | 'advisor' | 'settings';

const destinations: { id: MobileDestination; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z' },
  { id: 'visualise', label: 'Visualise', path: 'M5 17l6-10 8 8 M5 14v6 M2 17h6 M11 4v6 M8 7h6 M19 12v6 M16 15h6' },
  { id: 'explore', label: 'Explore', path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15.5 8.5l-2 5-5 2 2-5z' },
  { id: 'advisor', label: 'Advisor', path: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 9h8 M8 13h5' },
  { id: 'settings', label: 'Settings', path: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export const MobileNavigation = ({ active, onChange }: { active: MobileDestination; onChange: (destination: MobileDestination) => void }) => (
  <nav aria-label="Primary navigation" className="mobile-navigation md:hidden print:hidden">
    {destinations.map(({ id, label, path }) => (
      <button key={id} type="button" aria-current={active === id ? 'page' : undefined} onClick={() => onChange(id)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${active === id ? 'bg-ink text-canvas' : 'text-muted active:bg-paper'}`}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d={path} /></svg>
        <span className="max-w-full truncate">{label}</span>
      </button>
    ))}
  </nav>
);
