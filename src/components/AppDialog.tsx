import type { ReactNode } from 'react';

interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
}

interface AppDialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: DialogAction[];
  labelledBy?: string;
}

export const AppDialog = ({ title, children, onClose, actions, labelledBy }: AppDialogProps) => {
  const titleId = labelledBy ?? `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/35 px-4"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-canvas p-5 text-ink shadow-soft"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-sm font-semibold">{title}</h2>
        <div className="mt-2 text-xs leading-relaxed text-muted">{children}</div>
        <div className="mt-4 flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`flex-1 rounded-2xl px-3 py-2 text-xs font-medium ${buttonClass(action.variant)}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const buttonClass = (variant: DialogAction['variant'] = 'secondary'): string => {
  if (variant === 'primary') return 'bg-ink text-canvas';
  if (variant === 'danger') return 'bg-red-100 text-red-800';
  return 'bg-ink/10 text-ink/70';
};
