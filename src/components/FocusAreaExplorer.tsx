import { useEffect } from 'react';
import type { Major, StudentSemester, WaivedModule } from '@shared/types';
import { computeFocusAreas, courseLevel } from '../lib/studyPlan';
import { MUTED } from '../lib/colors';

interface Props {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  onClose: () => void;
}

export const FocusAreaExplorer = ({ major, semesters, waivedModules, onClose }: Props) => {
  const takenCodes = new Set([
    ...semesters.flatMap((s) => s.modules.map((m) => m.code)),
    ...waivedModules.map((m) => m.code),
  ]);
  const { areas } = computeFocusAreas(major, semesters, waivedModules);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Focus areas"
    >
      <div
        className="my-auto w-full max-w-3xl rounded-4xl bg-paper p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">Focus Areas</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-sm text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mb-5 text-[11px] leading-relaxed text-muted">
          Complete <span className="font-medium text-ink">any one</span> area: 3 courses from its
          Primaries, at least one at level-4000 (marked <LevelTag />). A CS Foundation course in the
          Primaries counts as one. Electives are related but don&rsquo;t count toward completion.
        </p>

        <div className="flex flex-col gap-4">
          {areas.map((area) => {
            const source = major.focusAreas?.find((a) => a.id === area.id);
            if (!source) return null;
            return (
              <section
                key={area.id}
                className={`rounded-3xl p-4 ${area.fulfilled ? 'bg-canvas' : 'bg-canvas/50'}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{area.label}</h3>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                    style={
                      area.fulfilled
                        ? { backgroundColor: 'rgb(20,20,19)', color: 'rgb(239,238,231)' }
                        : { backgroundColor: 'rgba(20,20,19,0.08)', color: MUTED }
                    }
                  >
                    {area.fulfilled
                      ? 'Complete'
                      : `${area.matched.length}/${area.need} · ${area.seniorMatched.length}/${area.needSenior} L4000`}
                  </span>
                </div>

                <CodeGroup label="Primaries" codes={source.primaries} taken={takenCodes} />
                {source.electives && source.electives.length > 0 && (
                  <CodeGroup label="Electives" codes={source.electives} taken={takenCodes} muted />
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CodeGroup = ({
  label,
  codes,
  taken,
  muted = false,
}: {
  label: string;
  codes: string[];
  taken: Set<string>;
  muted?: boolean;
}) => (
  <div className="mb-2 last:mb-0">
    <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const isTaken = taken.has(code);
        const senior = courseLevel(code) >= 4000;
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-[11px]"
            style={
              isTaken
                ? { backgroundColor: 'rgb(20,20,19)', color: 'rgb(239,238,231)' }
                : {
                    backgroundColor: muted ? 'transparent' : 'rgba(20,20,19,0.05)',
                    color: MUTED,
                    border: muted ? '1px solid rgba(20,20,19,0.12)' : 'none',
                  }
            }
          >
            {code}
            {senior && <LevelTag on={isTaken} />}
          </span>
        );
      })}
    </div>
  </div>
);

const LevelTag = ({ on = false }: { on?: boolean }) => (
  <span
    className="rounded px-1 text-[8px] font-bold leading-none"
    style={{
      backgroundColor: on ? 'rgba(239,238,231,0.25)' : 'rgba(20,20,19,0.12)',
      color: on ? 'rgb(239,238,231)' : MUTED,
    }}
  >
    4K
  </span>
);
