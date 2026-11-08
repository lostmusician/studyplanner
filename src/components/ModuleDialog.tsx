import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from '../hooks/useModalFocus';
import { XIcon } from './Icons';

export const ModuleDialog = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus({ active: true, modal: true, containerRef: ref, onClose });
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/35 p-4" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-canvas p-5 text-ink shadow-soft focus:outline-none">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/10"><XIcon className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>, document.body,
  );
};
