import { useEffect } from 'react';
import type { Major, StudentSemester, WaivedModule } from '@shared/types';
import { computeProgrammeElectives, courseLevel } from '../lib/studyPlan';

interface Props {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  onClose: () => void;
}

export const ProgrammeElectivesExplorer = ({ major, semesters, waivedModules, onClose }: Props) => {
  const takenCodes = new Set([
    ...semesters.flatMap((s) => s.modules.map((m) => m.code)),
    ...waivedModules.map((m) => m.code),
  ]);
  const cfg = major.programmeElectives;
  const result = computeProgrammeElectives(major, semesters, waivedModules);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!cfg || !result) return null;

  const ruleClauses = [`complete ${cfg.minCourses} distinct courses across these categories`];
  if (cfg.minLevel4000Courses) {
    ruleClauses.push(`at least ${cfg.minLevel4000Courses} at level-4000+ (marked`);
  }
  for (const rule of cfg.minPrefixCourses ?? []) {
    ruleClauses.push(`at least ${rule.minCourses} ${rule.prefix}-coded`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Programme electives"
    >
      <div
        className="my-auto w-full max-w-3xl rounded-4xl bg-paper p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">Programme Electives</h2>
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
          Complete <span className="font-medium text-ink">{cfg.minCourses} distinct courses</span> across
          these categories.
          {cfg.minLevel4000Courses && (
            <>
              {' '}
              At least <span className="font-medium text-ink">{cfg.minLevel4000Courses}</span> must be at
              level-4000+ (marked <LevelTag />).
            </>
          )}
          {(cfg.minPrefixCourses ?? []).map((rule) => (
            <span key={rule.prefix}>
              {' '}
              At least <span className="font-medium text-ink">{rule.minCourses}</span> must be{' '}
              {rule.prefix}-coded.
            </span>
          ))}
        </p>

        <div className="flex flex-col gap-4">
          {cfg.categories.map((cat) => {
            const status = result.categories.find((c) => c.id === cat.id);
            return (
              <section key={cat.id} className="rounded-3xl bg-canvas/50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{cat.label}</h3>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                    style={{ backgroundColor: 'rgba(20,20,19,0.08)', color: 'rgb(108,107,104)' }}
                  >
                    {status?.matched.length ?? 0}/{cat.courses.length} taken
                  </span>
                </div>
                <CodeGroup codes={cat.courses} taken={takenCodes} />
              </section>
            );
          })}
        </div>

        {cfg.specialisations && cfg.specialisations.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">Optional Specialisations</p>
            <div className="flex flex-col gap-3">
              {cfg.specialisations.map((spec) => {
                const status = result.specialisations.find((s) => s.id === spec.id);
                const need = spec.minCourses ?? spec.courses.length;
                return (
                  <section key={spec.id} className="rounded-3xl bg-canvas/30 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-medium text-muted">{spec.label}</h3>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                        style={{ backgroundColor: 'rgba(20,20,19,0.06)', color: 'rgb(108,107,104)' }}
                      >
                        {status?.matched.length ?? 0}/{need}
                      </span>
                    </div>
                    <CodeGroup codes={spec.courses} taken={takenCodes} muted />
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CodeGroup = ({
  codes,
  taken,
  muted = false,
}: {
  codes: string[];
  taken: Set<string>;
  muted?: boolean;
}) => (
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
                  color: 'rgb(108,107,104)',
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
);

const LevelTag = ({ on = false }: { on?: boolean }) => (
  <span
    className="rounded px-1 text-[8px] font-bold leading-none"
    style={{
      backgroundColor: on ? 'rgba(239,238,231,0.25)' : 'rgba(20,20,19,0.12)',
      color: on ? 'rgb(239,238,231)' : 'rgb(108,107,104)',
    }}
  >
    4K
  </span>
);
