import { useState } from 'react';
import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';
import { buildShareLink } from '@shared/share';
import { StatsSummary } from './StatsSummary';
import { SemesterGrid } from './SemesterGrid';

interface Props {
  majors: Major[];
  major: Major;
  majorId: string;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  stats: Stats;
  requirements: RequirementStatus[];
  switchMajor: (id: string) => void;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule) => void;
  deleteModule: (code: string) => void;
  updateModule: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
  addWaivedModule: (module: WaivedModule) => void;
  deleteWaivedModule: (code: string) => void;
  resetPlan: () => void;
  getCompletedCodes: (year: number, sem: number) => string[];
  studentName: string;
  setStudentName: (name: string) => void;
  matricNumber: string;
  setMatricNumber: (matric: string) => void;
  studentYear: string;
  setStudentYear: (year: string) => void;
}

export const StudyPlan = ({
  majors,
  major,
  majorId,
  semesters,
  waivedModules,
  stats,
  requirements,
  switchMajor,
  addOrMoveModule,
  deleteModule,
  updateModule,
  addWaivedModule,
  deleteWaivedModule,
  resetPlan,
  getCompletedCodes,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
}: Props) => {
  const [view, setView] = useState<'planner' | 'settings'>('planner');
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    const link = buildShareLink({
      profile: { name: studentName, matricNumber, year: studentYear },
      plan: { majorId, semesters, waivedModules },
    });
    try {
      await navigator.clipboard.writeText(link);
      setShareState('copied');
    } catch {
      // Clipboard can be blocked (e.g. insecure context); surface the link so it's still usable.
      window.prompt('Copy this share link:', link);
      setShareState('error');
    }
    window.setTimeout(() => setShareState('idle'), 2000);
  };

  const handleSwitchMajor = (id: string) => {
    if (id === majorId) return;
    if (confirm('Switching major will reset your plan. Continue?')) {
      switchMajor(id);
    }
  };

  const handleResetPlan = () => {
    if (confirm('Reset plan to default?')) resetPlan();
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="px-4 py-3 sm:px-6 sm:py-5" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex flex-col gap-0.5 sm:min-w-[138px]">
              <span className="text-base font-semibold leading-tight text-ink">{studentName || 'Student Name'}</span>
              <span className="text-xs leading-tight text-muted">
                {matricNumber ? `${studentYear} · ${matricNumber}` : studentYear}
              </span>
            </div>

            <div className="hidden sm:block h-10 w-px" style={{ backgroundColor: 'rgba(20,20,19,0.1)' }} />

            <MajorHeaderSelect
              majors={majors}
              major={major}
              majorId={majorId}
              onChange={handleSwitchMajor}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
            >
              {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Copy manually' : 'Share'}
            </button>
            <button
              onClick={() => setView((current) => (current === 'settings' ? 'planner' : 'settings'))}
              className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
            >
              {view === 'settings' ? 'Planner' : 'Settings'}
            </button>
          </div>
        </div>
      </header>

      {view === 'settings' ? (
        <SettingsPage
          majors={majors}
          majorId={majorId}
          studentName={studentName}
          setStudentName={setStudentName}
          matricNumber={matricNumber}
          setMatricNumber={setMatricNumber}
          studentYear={studentYear}
          setStudentYear={setStudentYear}
          onSwitchMajor={handleSwitchMajor}
          onResetPlan={handleResetPlan}
        />
      ) : (
        <>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
            <div className="max-w-screen-2xl mx-auto">
              <StatsSummary
                major={major}
                stats={stats}
                semesters={semesters}
                waivedModules={waivedModules}
                requirements={requirements}
              />
            </div>
          </div>

          <div className="max-w-screen-2xl mx-auto px-6 py-6">
            <div className="flex min-w-0 flex-col gap-5">
              <SemesterGrid
                semesters={semesters}
                major={major}
                waivedModules={waivedModules}
                addOrMoveModule={addOrMoveModule}
                deleteModule={deleteModule}
                updateModule={updateModule}
                addWaivedModule={addWaivedModule}
                deleteWaivedModule={deleteWaivedModule}
                getCompletedCodes={getCompletedCodes}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MajorHeaderSelect = ({
  majors,
  major,
  majorId,
  onChange,
}: {
  majors: Major[];
  major: Major;
  majorId: string;
  onChange: (id: string) => void;
}) => (
  <div className="flex flex-col items-start gap-0.5">
    <label className="relative block leading-tight">
      <span className="pointer-events-none flex items-center gap-1 pr-5 text-sm font-medium leading-tight text-ink">
        {major.label}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 text-ink/70"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </span>
      <select
        value={majorId}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Major"
      >
        {majors.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>
    </label>
    {major.specialisation && (
      <span className="text-xs leading-tight text-muted">{major.specialisation}</span>
    )}
    <span className="text-[10px] leading-tight text-muted/70">{major.school}</span>
  </div>
);

const SettingsPage = ({
  majors,
  majorId,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
  onSwitchMajor,
  onResetPlan,
}: {
  majors: Major[];
  majorId: string;
  studentName: string;
  setStudentName: (name: string) => void;
  matricNumber: string;
  setMatricNumber: (matric: string) => void;
  studentYear: string;
  setStudentYear: (year: string) => void;
  onSwitchMajor: (id: string) => void;
  onResetPlan: () => void;
}) => {
  const field =
    'rounded-2xl bg-canvas border border-ink/10 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold text-ink">Settings</h1>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-4xl bg-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Profile</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted">Name</span>
              <input
                type="text"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted">Matric Number</span>
              <input
                type="text"
                value={matricNumber}
                onChange={(event) => setMatricNumber(event.target.value)}
                placeholder="A0123456X"
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted">Year</span>
              <select
                value={studentYear}
                onChange={(event) => setStudentYear(event.target.value)}
                className={field}
              >
                {[1, 2, 3, 4].map((year) => (
                  <option key={year} value={`Year ${year}`}>Year {year}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-4xl bg-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Programme</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Major</span>
            <select
              value={majorId}
              onChange={(event) => onSwitchMajor(event.target.value)}
              className={field}
            >
              {majors.map((major) => (
                <option key={major.id} value={major.id}>{major.label}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="rounded-4xl bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Plan</h2>
            <button
              type="button"
              onClick={onResetPlan}
              className="rounded-2xl bg-canvas px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas/70"
            >
              Reset to default
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};