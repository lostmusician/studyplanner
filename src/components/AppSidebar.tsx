import type { AppDestination } from '../lib/navigation';

interface Props {
  active: AppDestination;
  onNavigate: (destination: AppDestination) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  studentName: string;
  majorLabel: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const NAV_ITEMS: { id: AppDestination; label: string; path: string }[] = [
  {
    id: 'home',
    label: 'Home',
    path: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  },
  {
    id: 'visualise',
    label: 'Visualise',
    path: 'M5 17l6-10 8 8 M5 14v6 M2 17h6 M11 4v6 M8 7h6 M19 12v6 M16 15h6',
  },
  {
    id: 'explore',
    label: 'Explore',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
  },
];

const GEAR_PATH = 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';

export const AppSidebar = ({
  active,
  onNavigate,
  settingsOpen,
  onToggleSettings,
  studentName,
  majorLabel,
  isCollapsed = false,
  onToggleCollapse,
}: Props) => (
  <aside
    className={`app-sidebar fixed inset-y-0 left-0 z-30 hidden h-dvh shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-ink/10 bg-paper/45 transition-[width] duration-200 ease-in-out md:flex print:hidden ${
      isCollapsed ? 'w-16 items-center' : 'w-60 lg:w-64'
    }`}
  >
    {isCollapsed ? (
      <div className="flex items-center justify-center py-4">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m12 9 3 3-3 3" />
            </svg>
          </button>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between px-4 pb-4 pt-5">
        <p className="truncate text-sm font-semibold tracking-tight text-ink">StudyPlanner</p>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9-3 3 3 3" />
            </svg>
          </button>
        )}
      </div>
    )}

    <nav
      aria-label="App sections"
      className={isCollapsed ? 'flex flex-col items-center gap-1.5 px-2' : 'flex flex-col gap-1 px-3'}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={isCollapsed ? item.label : undefined}
            title={isCollapsed ? item.label : undefined}
            className={`transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              isCollapsed
                ? 'flex h-10 w-10 items-center justify-center rounded-xl'
                : 'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm'
            } ${
              isActive
                ? 'bg-ink font-semibold text-canvas'
                : 'text-muted hover:bg-ink/[0.06] hover:text-ink'
            }`}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d={item.path} />
            </svg>
            {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>

    <div className={isCollapsed ? 'mt-auto flex flex-col items-center gap-2 px-2 pb-4' : 'mt-auto flex flex-col gap-2 px-3 pb-4'}>
      {!isCollapsed && (
        <div className="rounded-xl border border-ink/10 bg-canvas/60 px-3 py-2">
          <p className="truncate text-xs font-medium text-ink">{studentName || 'Student Name'}</p>
          <p className="truncate text-[10px] text-muted">{majorLabel}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onToggleSettings}
        aria-expanded={settingsOpen}
        aria-controls="settings-panel"
        aria-label={isCollapsed ? 'Settings' : undefined}
        title={isCollapsed ? 'Settings' : undefined}
        className={`transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          isCollapsed
            ? 'flex h-10 w-10 items-center justify-center rounded-xl'
            : 'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm'
        } ${
          settingsOpen
            ? 'bg-ink/[0.09] font-semibold text-ink'
            : 'text-muted hover:bg-ink/[0.06] hover:text-ink'
        }`}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-80"
        >
          <path d={GEAR_PATH} />
        </svg>
        {!isCollapsed && <span className="min-w-0 flex-1 truncate">Settings</span>}
        {!isCollapsed && (
          <span aria-hidden="true" className="text-[10px] text-muted">
            {settingsOpen ? '−' : '+'}
          </span>
        )}
      </button>
    </div>
  </aside>
);
