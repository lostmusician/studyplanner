import { useEffect, useState } from 'react';
import type { Major, PlacedModule } from '@shared/types';
import {
  fetchNusModsModuleDetail,
  assessPrerequisiteConflict,
  formatPrerequisiteSummary,
} from '@shared/nusmods';
import type { NusModsModuleDetail } from '@shared/nusmods';

interface Props {
  module: PlacedModule;
  major: Major;
  completedCodes: string[];
  onClose: () => void;
}

const semesterName = (sem: number): string =>
  ({ 1: 'Semester 1', 2: 'Semester 2', 3: 'Special Term I', 4: 'Special Term II' }[sem] ?? `Semester ${sem}`);

export const CourseDetailModal = ({ module, major, completedCodes, onClose }: Props) => {
  const [detail, setDetail] = useState<NusModsModuleDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const category = major.categories.find((c) => c.id === module.categoryId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchNusModsModuleDetail(module.code)
      .then(({ detail }) => {
        if (cancelled) return;
        setDetail(detail);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [module.code]);

  const missing = detail ? assessPrerequisiteConflict(detail, completedCodes).missingRequirement : null;
  const semesters = detail?.semesterData?.map((s) => s.semester) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${module.code} details`}
    >
      <div
        className="my-auto w-full max-w-2xl rounded-4xl bg-paper p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-mono text-base font-bold text-ink">{module.code}</h2>
            <p className="mt-0.5 text-sm text-ink/80">{detail?.title ?? module.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pill>{module.mcs} MC</Pill>
              {category && (
                <Pill style={{ backgroundColor: category.color, color: 'rgb(20,20,19)' }}>
                  {category.label}
                </Pill>
              )}
              {detail?.acadYear && <Pill>AY{detail.acadYear}</Pill>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-xl px-2 py-1 text-sm text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {status === 'loading' && <p className="text-xs text-muted">Loading course details…</p>}
        {status === 'error' && (
          <p className="text-xs text-muted">Couldn&rsquo;t load details from NUSMods for this course.</p>
        )}

        {status === 'ready' && detail && (
          <div className="flex flex-col gap-4">
            {missing && (
              <div
                className="rounded-2xl px-3 py-2 text-xs leading-relaxed"
                style={{ backgroundColor: 'rgb(254,243,199)', color: 'rgb(180,83,9)' }}
              >
                <span className="font-semibold">Missing prerequisites: </span>
                {missing}
                <span className="mt-0.5 block opacity-80">
                  Based on courses scheduled before this one in your plan.
                </span>
              </div>
            )}

            {detail.description && (
              <Section label="Description">
                <p className="text-xs leading-relaxed text-ink/80">{detail.description}</p>
              </Section>
            )}

            <Section label="Prerequisites">
              <p className="text-xs leading-relaxed text-ink/80">{formatPrerequisiteSummary(detail)}</p>
            </Section>

            {detail.preclusion && (
              <Section label="Preclusions">
                <p className="text-xs leading-relaxed text-ink/80">{detail.preclusion}</p>
              </Section>
            )}

            {detail.corequisite && (
              <Section label="Corequisites">
                <p className="text-xs leading-relaxed text-ink/80">{detail.corequisite}</p>
              </Section>
            )}

            <div className="flex flex-wrap gap-6">
              {semesters.length > 0 && (
                <Section label="Offered in">
                  <div className="flex flex-wrap gap-1.5">
                    {semesters.map((s) => (
                      <Pill key={s}>{semesterName(s)}</Pill>
                    ))}
                  </div>
                </Section>
              )}
              {(detail.department || detail.faculty) && (
                <Section label="Offered by">
                  <p className="text-xs leading-relaxed text-ink/80">
                    {[detail.department, detail.faculty].filter(Boolean).join(' · ')}
                  </p>
                </Section>
              )}
            </div>

            <a
              href={`https://nusmods.com/courses/${module.code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-ink underline underline-offset-2 hover:opacity-70"
            >
              View on NUSMods →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    {children}
  </div>
);

const Pill = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <span
    className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
    style={style ?? { backgroundColor: 'rgba(20,20,19,0.08)', color: 'rgb(108,107,104)' }}
  >
    {children}
  </span>
);
