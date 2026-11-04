import { useEffect } from 'react';
import type { Major } from '@shared/types';
import type { RecommendationResult } from '../lib/aiPlanner';
import { SparklesIcon, XIcon, LockIcon } from './Icons';

interface Props {
  major: Major;
  result: RecommendationResult;
  onApply: () => void;
  onClose: () => void;
}

export const RecommendationResultModal = ({
  major,
  result,
  onApply,
  onClose,
}: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addedSet = new Set(result.addedModules.map((m) => `${m.year}-${m.sem}-${m.code}`));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Recommended Study Plan"
    >
      <div className="my-auto w-full max-w-3xl rounded-4xl bg-paper p-6 sm:p-8 shadow-soft border border-line/30">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-line/20">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-700 shrink-0">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  AI Recommendation
                </span>
                <span className="text-xs text-muted font-mono">{major.label}</span>
              </div>
              <h2 className="text-lg font-bold text-ink mt-0.5">{result.trackTitle}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted hover:bg-canvas hover:text-ink transition-colors"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 flex flex-col gap-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* Rationale Banner */}
          <div className="rounded-2xl bg-canvas p-4 border border-line/30">
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wide mb-1">
              Why this fits your profile
            </h3>
            <p className="text-xs leading-relaxed text-ink/80">{result.trackRationale}</p>
            {result.recommendedMinorRationale && (
              <p className="text-xs leading-relaxed text-muted mt-2 pt-2 border-t border-line/20">
                <span className="font-semibold text-ink">Secondary Programme: </span>
                {result.recommendedMinorRationale}
              </p>
            )}
          </div>

          {/* Warnings Banner if any */}
          {result.warnings.length > 0 && (
            <div className="rounded-2xl bg-amber-500/10 p-4 border border-amber-500/30 text-amber-900 text-xs">
              <span className="font-semibold block mb-1">Advisory Notes:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                {result.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Curated Electives Highlights */}
          {result.recommendedElectives.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ink uppercase tracking-wide mb-2.5">
                Curated Electives
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.recommendedElectives.map((elec) => (
                  <div
                    key={elec.code}
                    className="rounded-2xl border border-line/30 bg-canvas/80 p-3 hover:border-line transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-ink">{elec.code}</span>
                      <span className="text-[10px] text-muted truncate max-w-[150px]">{elec.title}</span>
                    </div>
                    <p className="text-[11px] text-muted leading-snug">{elec.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Semester Schedule Preview */}
          <div>
            <h3 className="text-xs font-semibold text-ink uppercase tracking-wide mb-2.5">
              Semester Schedule Diff
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {result.updatedSemesters.map((sem) => {
                const totalMcs = sem.modules.reduce((sum, m) => sum + m.mcs, 0);
                const hasNewModules = sem.modules.some((m) =>
                  addedSet.has(`${sem.year}-${sem.sem}-${m.code}`),
                );

                return (
                  <div
                    key={`${sem.year}-${sem.sem}`}
                    className={`rounded-2xl p-3 border transition-colors ${
                      hasNewModules
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-canvas border-line/30'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-line/20">
                      <span className="text-xs font-bold text-ink">
                        Y{sem.year}S{sem.sem}
                      </span>
                      <span className="text-[10px] font-mono text-muted">{totalMcs} MCs</span>
                    </div>

                    <div className="flex flex-col gap-1 min-h-[70px]">
                      {sem.modules.length === 0 ? (
                        <span className="text-[10px] text-muted/60 italic my-auto text-center">Empty</span>
                      ) : (
                        sem.modules.map((m) => {
                          const isNewlyAdded = addedSet.has(`${sem.year}-${sem.sem}-${m.code}`);
                          return (
                            <div
                              key={m.code}
                              className={`flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                isNewlyAdded
                                  ? 'bg-emerald-100 text-emerald-950 font-semibold'
                                  : 'text-ink/80'
                              }`}
                            >
                              <span>{m.code}</span>
                              {isNewlyAdded && (
                                <span className="text-[9px] text-emerald-700 bg-emerald-200/60 px-1 rounded">
                                  New
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-line/20">
          <p className="text-[11px] text-muted flex items-center gap-1">
            <LockIcon className="h-3 w-3 text-muted/80" />
            <span>Completed past semesters are safely preserved.</span>
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-canvas border border-line/30 px-4 py-2 text-xs font-medium text-ink hover:bg-paper transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-ink px-5 py-2 text-xs font-semibold text-canvas hover:bg-ink/90 transition-opacity shadow-sm"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Apply Changes to Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
