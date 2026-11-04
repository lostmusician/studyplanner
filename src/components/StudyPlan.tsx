import { useState, useEffect } from 'react';
import type { Major, PlacedModule, StudentSemester, WaivedModule, SecondaryProgramme, NocDuration, SpecialProgramme } from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';
import { computeTripleCountedCodes } from '../lib/studyPlan';
import { MUTED } from '../lib/colors';
import { buildShareLink } from '@shared/share';
import { StatsSummary } from './StatsSummary';
import { SemesterGrid } from './SemesterGrid';
import { BatchBadge } from './BatchBadge';
import { AppDialog } from './AppDialog';
import { Dropdown } from './Dropdown';
import { SecondaryProgrammePanel } from './SecondaryProgrammePanel';
import { PrintView } from './PrintView';

interface Props {
  majors: Major[];
  major: Major;
  majorId: string;
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  nocDuration: NocDuration | null;
  specialProgramme: SpecialProgramme | null;
  setSpecialProgramme: (programme: SpecialProgramme | null) => void;
  requirementMappings: Record<string, string[]>;
  addRequirementMapping: (requirementName: string, moduleCode: string) => void;
  removeRequirementMapping: (requirementName: string, moduleCode: string) => void;
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
  addSpecialTerm: (year: number, sem: number) => void;
  deleteSpecialTerm: (year: number, sem: number) => void;
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
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
  nocDuration,
  specialProgramme,
  setSpecialProgramme,
  requirementMappings,
  addRequirementMapping,
  removeRequirementMapping,
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
  addSpecialTerm,
  deleteSpecialTerm,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareDialogLink, setShareDialogLink] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const [showShareNameDialog, setShowShareNameDialog] = useState(false);
  const [shareNameDraft, setShareNameDraft] = useState('');
  const [shareNameError, setShareNameError] = useState(false);
  const [pendingMajorId, setPendingMajorId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [secondaryPanelsOpen, setSecondaryPanelsOpen] = useState(false);
  const reviewLabel = reviewOwnerName?.trim() || 'Shared plan';

  const copyShareLink = async (name: string) => {
    const link = buildShareLink({
      profile: { name, matricNumber, year: studentYear },
      plan: { majorId, semesters, waivedModules, secondMajorId, minorIds, requirementMappings, nocDuration, specialProgramme },
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

  const declaredSecondMajor = secondMajorId
    ? secondMajors.find((item) => item.id === secondMajorId) ?? null
    : null;
  const declaredMinors = minors.filter((item) => minorIds.includes(item.id));
  const declaredSecondaries = declaredSecondMajor ? [declaredSecondMajor, ...declaredMinors] : declaredMinors;
  const tripleCountedCodes = computeTripleCountedCodes(declaredSecondaries, semesters, waivedModules);

  return (
    <>
      <div className="min-h-screen bg-canvas print:hidden">
        <header
          className={`sticky top-0 z-40 bg-canvas/90 backdrop-blur-md px-4 py-2.5 sm:px-6 transition-all duration-300 border-b border-ink/10 ${
            isScrolled ? 'shadow-xs' : 'shadow-none'
          }`}
        >
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 sm:gap-6 min-h-[38px]">
            {/* Left Slot: Settings Toggle */}
            <div className="flex items-center min-w-[120px]">
              <button
                onClick={() => setSidebarOpen((open) => !open)}
                className={`flex items-center gap-1.5 text-xs transition-colors px-2.5 py-1.5 rounded-xl ${
                  sidebarOpen
                    ? 'bg-paper text-ink font-semibold'
                    : 'text-muted hover:text-ink hover:bg-paper'
                }`}
                title={sidebarOpen ? 'Hide Settings Sidebar' : 'Show Settings Sidebar'}
              >
                <svg className="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{sidebarOpen ? 'Hide Settings' : 'Settings'}</span>
              </button>
            </div>

            {/* Center Slot: Smoothly cross-fading detailed vs compact view */}
            <div className="flex flex-1 items-center justify-center min-w-0 relative">
              {/* Detailed View (Top of page) */}
              <div
                className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 transition-all duration-300 transform ${
                  isScrolled
                    ? 'opacity-0 -translate-y-2 pointer-events-none absolute'
                    : 'opacity-100 translate-y-0 relative'
                }`}
              >
                <div className="flex flex-col items-center sm:items-start gap-0.5">
                  <span className="text-sm sm:text-base font-semibold leading-tight text-ink">{studentName || 'Student Name'}</span>
                  <span className="text-xs leading-tight text-muted">
                    {matricNumber ? <>{studentYear} &middot; {matricNumber}</> : studentYear}
                  </span>
                </div>

                <div className="hidden sm:block h-6 w-px bg-line/20" />

                <div className="hidden sm:block">
                  <MajorHeaderSelect
                    majors={majors}
                    major={major}
                    majorId={majorId}
                    onChange={handleSwitchMajor}
                    secondMajor={declaredSecondMajor}
                    declaredMinors={declaredMinors}
                  />
                </div>
              </div>

              {/* Summarized View (Scrolled down) */}
              <div
                className={`flex items-center justify-center gap-1.5 text-xs truncate max-w-xl px-2 transition-all duration-300 transform ${
                  isScrolled
                    ? 'opacity-100 translate-y-0 relative'
                    : 'opacity-0 translate-y-2 pointer-events-none absolute'
                }`}
              >
                <span className="font-semibold text-ink truncate">{studentName || 'Student Name'}</span>
                <span className="text-muted/60 font-mono">&middot;</span>
                <span className="text-muted truncate">{studentYear}</span>
                <span className="text-muted/60 font-mono hidden sm:inline">&middot;</span>
                <span className="font-semibold text-ink/80 truncate hidden sm:inline">{major.label}</span>
              </div>
            </div>

            {/* Right Slot: Actions */}
            <div className="flex items-center justify-end min-w-[120px] gap-1 sm:gap-2">
              <button
                onClick={() => window.print()}
                className="text-xs text-muted hover:text-ink transition-colors px-2.5 py-1.5 rounded-xl hover:bg-paper"
              >
                Print
              </button>
              <button
                onClick={handleShare}
                className="text-xs text-muted hover:text-ink transition-colors px-2.5 py-1.5 rounded-xl hover:bg-paper"
              >
                {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Copy manually' : 'Share'}
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

        <div className="relative flex min-h-[calc(100vh-65px)] min-w-0">
          {/* Left Sidebar / Mobile Overlay (Settings) */}
          <aside
            className={`transition-all duration-300 ease-in-out ${sidebarOpen
                ? 'translate-x-0 opacity-100 pointer-events-auto lg:w-80 lg:p-5 lg:border-r lg:border-line/20'
                : '-translate-x-full opacity-0 pointer-events-none lg:w-0 lg:p-0 lg:border-0 lg:translate-x-0'
              } fixed inset-0 top-0 z-50 flex flex-col w-full h-full bg-paper p-5 overflow-y-auto shadow-2xl lg:sticky lg:top-[49px] lg:h-[calc(100vh-49px)] lg:shrink-0 lg:bg-paper/60 lg:shadow-none lg:backdrop-blur-sm lg:z-30`}
          >
            <div className="w-full lg:w-[280px] shrink-0">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line/20">
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider">Plan Settings</h2>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink transition-colors hover:bg-ink/20"
                  aria-label="Close settings"
                >
                  ✕
                </button>
              </div>
              <SettingsSidebar
                majors={majors}
                majorId={majorId}
                secondMajors={secondMajors}
                minors={minors}
                secondMajorId={secondMajorId}
                minorIds={minorIds}
                setSecondMajorId={setSecondMajorId}
                toggleMinorId={toggleMinorId}
                nocDuration={nocDuration}
                specialProgramme={specialProgramme}
                setSpecialProgramme={setSpecialProgramme}
                studentName={studentName}
                setStudentName={setStudentName}
                matricNumber={matricNumber}
                setMatricNumber={setMatricNumber}
                studentYear={studentYear}
                setStudentYear={setStudentYear}
                onSwitchMajor={handleSwitchMajor}
                onResetPlan={handleResetPlan}
              />
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
              <div className="max-w-screen-2xl mx-auto">
                <StatsSummary
                  major={major}
                  stats={stats}
                  semesters={semesters}
                  waivedModules={waivedModules}
                  requirements={requirements}
                  requirementMappings={requirementMappings}
                  addRequirementMapping={addRequirementMapping}
                  removeRequirementMapping={removeRequirementMapping}
                />
              </div>
            </div>

            {(declaredSecondMajor || declaredMinors.length > 0) && (
              <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
                <div className="max-w-screen-2xl mx-auto flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => setSecondaryPanelsOpen((open) => !open)}
                    className="flex items-center gap-2 text-left text-sm font-semibold text-ink"
                    aria-expanded={secondaryPanelsOpen}
                  >
                    <span>{secondaryPanelsOpen ? '▾' : '▸'}</span>
                    <span>Second Major &amp; Minor Progress</span>
                    {tripleCountedCodes.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        Triple-counting warning
                      </span>
                    )}
                  </button>

                  {secondaryPanelsOpen && (
                    <>
                      {tripleCountedCodes.length > 0 && (
                        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                          <strong className="font-semibold">Triple-counting warning:</strong>{' '}
                          {tripleCountedCodes.join(', ')}{' '}
                          {tripleCountedCodes.length === 1 ? 'is' : 'are'} being counted toward your primary
                          major and 2 or more secondary programmes at once &mdash; NUS does not allow this;
                          one programme will need a different module.
                        </div>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {declaredSecondMajor && (
                          <SecondaryProgrammePanel
                            programme={declaredSecondMajor}
                            semesters={semesters}
                            waivedModules={waivedModules}
                          />
                        )}
                        {declaredMinors.map((item) => (
                          <SecondaryProgrammePanel
                            key={item.id}
                            programme={item}
                            semesters={semesters}
                            waivedModules={waivedModules}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="max-w-screen-2xl mx-auto px-6 py-6 w-full">
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
                  addSpecialTerm={addSpecialTerm}
                  deleteSpecialTerm={deleteSpecialTerm}
                />
              </div>
            </div>
          </div>
        </div>

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
      <PrintView
        studentName={studentName}
        matricNumber={matricNumber}
        studentYear={studentYear}
        major={major}
        stats={stats}
        requirements={requirements}
        semesters={semesters}
        waivedModules={waivedModules}
        secondMajors={secondMajors}
        minors={minors}
        secondMajorId={secondMajorId}
        minorIds={minorIds}
        nocDuration={nocDuration}
        specialProgramme={specialProgramme}
      />
    </>
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
  secondMajor,
  declaredMinors,
}: {
  majors: Major[];
  major: Major;
  majorId: string;
  onChange: (id: string) => void;
  secondMajor: SecondaryProgramme | null;
  declaredMinors: SecondaryProgramme[];
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
    {(secondMajor || declaredMinors.length > 0) && (
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {secondMajor && <SecondaryProgrammeBadge label={`2nd Major: ${secondMajor.label}`} />}
        {declaredMinors.map((item) => (
          <SecondaryProgrammeBadge key={item.id} label={`Minor: ${item.label}`} />
        ))}
      </div>
    )}
  </div>
);

const SecondaryProgrammeBadge = ({ label }: { label: string }) => (
  <span
    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none"
    style={{ backgroundColor: 'rgba(20,20,19,0.06)', color: MUTED }}
  >
    {label}
  </span>
);

const SettingsSidebar = ({
  majors,
  majorId,
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
  nocDuration,
  specialProgramme,
  setSpecialProgramme,
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
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  nocDuration: NocDuration | null;
  specialProgramme: SpecialProgramme | null;
  setSpecialProgramme: (programme: SpecialProgramme | null) => void;
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
    'rounded-xl bg-canvas border border-line/40 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent w-full';

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
        <h3 className="mb-3 text-xs font-semibold text-ink uppercase tracking-wide">Profile</h3>
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Name</span>
            <input
              type="text"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Matric Number</span>
            <input
              type="text"
              value={matricNumber}
              onChange={(event) => setMatricNumber(event.target.value)}
              placeholder="A0123456X"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Year</span>
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

      <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
        <h3 className="mb-3 text-xs font-semibold text-ink uppercase tracking-wide">Programme</h3>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Primary Major</span>
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
            <div>
              <BatchBadge batches={major.batches} />
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Second Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Second Major"
              value={secondMajorId ?? ''}
              onChange={(id) => setSecondMajorId(id === '' ? null : id)}
              className={field}
              options={[
                { value: '', label: 'None' },
                ...secondMajors.map((item) => ({ value: item.id, label: item.label })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium flex items-center gap-1.5">
              <span>Global Pathway</span>
              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">NUSC Compulsory</span>
            </span>
            <Dropdown
              variant="field"
              ariaLabel="Global pathway"
              value={specialProgramme ?? ''}
              onChange={(v) => setSpecialProgramme(v === '' ? null : (v as SpecialProgramme))}
              className={field}
              options={[
                { value: '', label: 'Select Pathway (Required for NUSC)' },
                { value: 'sep', label: 'Student Exchange Programme (SEP, 1 semester)' },
                { value: 'noc-3-month', label: 'NOC 3-month (satisfies Industry Exp)' },
                { value: 'noc-6-month', label: 'NOC 6-month (waives 2 MCEs & Industry Exp)' },
                { value: 'noc-1-year', label: 'NOC 1-year (waives 4 MCEs & Industry Exp)' },
                { value: 'gex', label: 'Global Experience (GEx, credits 1 MCE)' },
                { value: 'regional-iex', label: 'Regional Impact Experience (Southeast Asia)' },
                { value: 'siip', label: 'Summer International Internship (SIIP)' },
              ]}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted font-medium">Minors (up to 3)</span>
            <div className="flex flex-wrap gap-1.5">
              {minors.map((item) => {
                const selected = minorIds.includes(item.id);
                const disabled = !selected && minorIds.length >= 3;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleMinorId(item.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${selected
                        ? 'bg-ink text-canvas shadow-xs'
                        : disabled
                          ? 'cursor-not-allowed bg-canvas/40 text-muted/40'
                          : 'bg-canvas border border-line/30 text-ink/80 hover:bg-canvas/80 hover:text-ink'
                      }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-ink uppercase tracking-wide">Reset Plan</h3>
          <button
            type="button"
            onClick={onResetPlan}
            className="rounded-xl bg-canvas border border-line/40 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper hover:border-line"
          >
            Reset
          </button>
        </div>
      </section>
    </div>
  );
};
