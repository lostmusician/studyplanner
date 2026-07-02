import { useState } from 'react';
import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';
import { buildShareLink } from '@shared/share';
import { StatsSummary } from './StatsSummary';
import { SemesterGrid } from './SemesterGrid';
import { BatchBadge } from './BatchBadge';
import { AppDialog } from './AppDialog';
import { Dropdown } from './Dropdown';

interface Props {
  majors: Major[];
  major: Major;
  majorId: string;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  stats: Stats;
  requirements: RequirementStatus[];
  switchMajor: (id: string) => void;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule, insertBeforeCode?: string) => void;
  deleteModule: (code: string, year?: number, sem?: number) => void;
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
  isReviewMode?: boolean;
  reviewOwnerName?: string;
  onExitReviewMode?: () => void;
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
  isReviewMode = false,
  reviewOwnerName,
  onExitReviewMode,
}: Props) => {
  const [view, setView] = useState<'planner' | 'settings'>('planner');
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareDialogLink, setShareDialogLink] = useState<string | null>(null);
  const [showShareNameDialog, setShowShareNameDialog] = useState(false);
  const [shareNameDraft, setShareNameDraft] = useState('');
  const [shareNameError, setShareNameError] = useState(false);
  const [pendingMajorId, setPendingMajorId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const reviewLabel = reviewOwnerName?.trim() || 'Shared plan';

  const copyShareLink = async (name: string) => {
    const link = buildShareLink({
      profile: { name, matricNumber, year: studentYear },
      plan: { majorId, semesters, waivedModules },
    }, major.moduleCatalog);
    try {
      await navigator.clipboard.writeText(link);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); surface the link so it's still usable.
      setShareDialogLink(link);
      setShareState('error');
    }
  };

  const handleShare = async () => {
    if (needsShareName(studentName)) {
      setShareNameDraft('');
      setShareNameError(false);
      setShowShareNameDialog(true);
      return;
    }

    await copyShareLink(studentName.trim());
  };

  const handleConfirmShareName = async () => {
    const nextName = shareNameDraft.trim();
    if (!nextName) {
      setShareNameError(true);
      return;
    }

    setStudentName(nextName);
    setShowShareNameDialog(false);
    await copyShareLink(nextName);
  };

  const handleCopyShareDialogLink = async () => {
    if (!shareDialogLink) return;
    try {
      await navigator.clipboard.writeText(shareDialogLink);
      setShareDialogLink(null);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch {
      setShareState('error');
    }
  };

  const handleSwitchMajor = (id: string) => {
    if (id === majorId) return;
    setPendingMajorId(id);
  };

  const confirmSwitchMajor = () => {
    if (!pendingMajorId) return;
    switchMajor(pendingMajorId);
    setPendingMajorId(null);
  };

  const handleResetPlan = () => {
    setShowResetConfirm(true);
  };

  const confirmResetPlan = () => {
    resetPlan();
    setShowResetConfirm(false);
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="px-4 py-3 sm:px-6 sm:py-5" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex flex-col gap-0.5 sm:min-w-[138px]">
              <span className="text-base font-semibold leading-tight text-ink">{studentName || 'Student Name'}</span>
              <span className="text-xs leading-tight text-muted">
                {matricNumber ? <>{studentYear} &middot; {matricNumber}</> : studentYear}
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

      {isReviewMode && (
        <div className="border-b border-ink/10 bg-sky-100/70 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-sky-950">
              <span className="rounded-full bg-sky-950 px-2 py-0.5 font-medium text-canvas">Review mode</span>
              <span className="leading-snug">Reviewing {reviewLabel}. Edits stay temporary.</span>
            </div>
            {onExitReviewMode && (
              <button
                type="button"
                onClick={onExitReviewMode}
                className="rounded-xl bg-canvas px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas/75"
              >
                Exit review
              </button>
            )}
          </div>
        </div>
      )}

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

      {pendingMajorId && (
        <AppDialog
          title="Switch major?"
          onClose={() => setPendingMajorId(null)}
          actions={[
            { label: 'Stay here', onClick: () => setPendingMajorId(null), variant: 'primary' },
            { label: 'Switch major', onClick: confirmSwitchMajor, variant: 'danger' },
          ]}
        >
          Switching major will reset your plan.
        </AppDialog>
      )}

      {showResetConfirm && (
        <AppDialog
          title="Reset plan?"
          onClose={() => setShowResetConfirm(false)}
          actions={[
            { label: 'Keep plan', onClick: () => setShowResetConfirm(false), variant: 'primary' },
            { label: 'Reset default', onClick: confirmResetPlan, variant: 'danger' },
          ]}
        >
          This will restore the default plan for your current major.
        </AppDialog>
      )}

      {shareDialogLink && (
        <AppDialog
          title="Copy share link"
          onClose={() => setShareDialogLink(null)}
          actions={[
            { label: 'Close', onClick: () => setShareDialogLink(null), variant: 'secondary' },
            { label: 'Copy link', onClick: handleCopyShareDialogLink, variant: 'primary' },
          ]}
        >
          <input
            readOnly
            value={shareDialogLink}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
            aria-label="Share link"
          />
        </AppDialog>
      )}

      {showShareNameDialog && (
        <AppDialog
          title="Set your name"
          onClose={() => setShowShareNameDialog(false)}
          actions={[
            { label: 'Cancel', onClick: () => setShowShareNameDialog(false), variant: 'secondary' },
            { label: 'Continue', onClick: handleConfirmShareName, variant: 'primary' },
          ]}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Name</span>
            <input
              type="text"
              value={shareNameDraft}
              onChange={(event) => {
                setShareNameDraft(event.target.value);
                setShareNameError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleConfirmShareName();
                }
              }}
              className="w-full rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              autoFocus
            />
          </label>
          {shareNameError && (
            <p className="mt-2 text-xs font-medium text-red-700">Enter a name before sharing.</p>
          )}
        </AppDialog>
      )}
    </div>
  );
};

const needsShareName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return normalized === '' || normalized === 'student name';
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
    <Dropdown
      variant="header"
      ariaLabel="Major"
      value={majorId}
      onChange={onChange}
      options={majors.map((item) => ({ value: item.id, label: item.label }))}
    />
    {major.specialisation && (
      <span className="text-xs leading-tight text-muted">{major.specialisation}</span>
    )}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] leading-tight text-muted/70">{major.school}</span>
      <BatchBadge batches={major.batches} />
    </div>
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
  const major = majors.find((m) => m.id === majorId);
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
              <Dropdown
                variant="field"
                ariaLabel="Year"
                value={studentYear}
                onChange={setStudentYear}
                className={field}
                options={[1, 2, 3, 4].map((year) => ({ value: `Year ${year}`, label: `Year ${year}` }))}
              />
            </label>
          </div>
        </section>

        <section className="rounded-4xl bg-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Programme</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Major"
              value={majorId}
              onChange={onSwitchMajor}
              className={field}
              options={majors.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          {major && (
            <div className="mt-2">
              <BatchBadge batches={major.batches} />
            </div>
          )}
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
