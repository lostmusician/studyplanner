import type { SharePayload } from '@shared/share';

interface Props {
  payload: SharePayload;
  /** Human-readable major label, or null when the major is unknown to this build. */
  majorLabel: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ImportModal = ({ payload, majorLabel, onConfirm, onCancel }: Props) => {
  const moduleCount = payload.plan.semesters.reduce((sum, s) => sum + s.modules.length, 0);
  const waivedCount = payload.plan.waivedModules.length;
  const name = payload.profile.name?.trim() || 'A student';
  const unknownMajor = majorLabel === null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-md rounded-4xl bg-canvas p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">Import shared plan</h2>

        {unknownMajor ? (
          <p className="mt-3 text-sm text-muted">
            This link is for a major that isn&apos;t available in this app, so it can&apos;t be
            imported.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              Import <span className="font-medium text-ink">{name}</span>&apos;s plan for{' '}
              <span className="font-medium text-ink">{majorLabel}</span>?
            </p>
            <ul className="mt-4 flex flex-col gap-1 text-sm text-muted">
              <li>{moduleCount} planned {moduleCount === 1 ? 'module' : 'modules'}</li>
              <li>{waivedCount} waived {waivedCount === 1 ? 'module' : 'modules'}</li>
              {payload.profile.matricNumber?.trim() && (
                <li>Matric number {payload.profile.matricNumber.trim()}</li>
              )}
            </ul>
            <p className="mt-4 text-xs text-muted">
              This replaces your current {majorLabel} plan and profile.
            </p>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-paper px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper/70"
          >
            {unknownMajor ? 'Close' : 'Cancel'}
          </button>
          {!unknownMajor && (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-2xl bg-ink px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/90"
            >
              Import plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
