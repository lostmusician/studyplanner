import { useRef } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useModalFocus } from '../hooks/useModalFocus';
import { SettingsSidebar, type SettingsSidebarProps } from './SettingsSidebar';

interface Props extends SettingsSidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Settings content panel. On desktop it opens as a full-height panel adjacent
 * to the app sidebar and left nonmodal so the app stays usable;
 * below 768px it becomes a modal sheet that clears the compact navigation bar.
 * The body scrolls internally so long Pathways/Degrees sections never trap or
 * overflow the page. */
export const SettingsPanel = ({ open, onClose, ...settingsProps }: Props) => {
  const isSheet = useMediaQuery('(max-width: 767px)');
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useModalFocus({
    active: open,
    modal: isSheet,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  if (!open) return null;

  return (
    <>
      <div
        className="settings-backdrop md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="settings-panel"
        ref={panelRef}
        className="settings-panel"
        role="dialog"
        aria-label="Plan settings"
        aria-modal={isSheet ? 'true' : undefined}
      >
        <div className="settings-panel__header flex shrink-0 items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Plan Settings</h2>
            <p className="text-xs text-muted">Profile · Degrees · Pathways</p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink transition-colors hover:bg-ink/20"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <SettingsSidebar {...settingsProps} />
        </div>
      </aside>
    </>
  );
};
