import { useState, useEffect } from 'react';
import type { Major, PlacedModule, StudentSemester, WaivedModule, SecondaryProgramme, NocDuration, SpecialProgramme } from '@shared/types';
import type { RequirementStatus, Stats, PlanTemplate } from '../lib/studyPlan';
import { computeTripleCountedCodes } from '../lib/studyPlan';
import { APP_DESTINATION_LABELS, type AppDestination } from '../lib/navigation';
import { MUTED } from '../lib/colors';
import { buildShareLink } from '@shared/share';
import { AppSidebar } from './AppSidebar';
import { SettingsPanel } from './SettingsPanel';
import type { SettingsSection } from './SettingsSidebar';
import { ExploreGallery } from './ExploreGallery';
import { MobileNavigation, type MobileDestination } from './MobileNavigation';
import { DoubleDegreePanel } from './DoubleDegreePanel';
import { StatsSummary } from './StatsSummary';
import { SemesterGrid } from './SemesterGrid';
import { BatchBadge } from './BatchBadge';
import { AppDialog } from './AppDialog';
import { Dropdown } from './Dropdown';
import { SecondaryProgrammePanel } from './SecondaryProgrammePanel';
import { PrintView } from './PrintView';
import { CompetencyExplorer } from './competency/CompetencyExplorer';
import { StudyPlanAdvisorSidebar } from './StudyPlanAdvisorSidebar';

interface Props {
  majors: Major[];
  major: Major;
  majorId: string;
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  doubleDegreeId: string | null;
  setDoubleDegreeId: (id: string | null) => void;
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  nocDuration: NocDuration | null;
  specialProgrammes: SpecialProgramme[];
  togglePathway: (programme: SpecialProgramme) => void;
  polytechnicApcUnits?: number;
  setPolytechnicApcUnits?: (units: number) => void;
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
  resetPlan: (template?: PlanTemplate | 'scratch') => void;
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
  applyAiPlan?: (
    semesters: StudentSemester[],
    minorId?: string | null,
    specialProgramme?: SpecialProgramme | null,
  ) => void;
}

export const StudyPlan = ({
  majors,
  major,
  majorId,
  secondMajors,
  minors,
  doubleDegreeId,
  setDoubleDegreeId,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
  nocDuration,
  specialProgrammes,
  togglePathway,
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
  polytechnicApcUnits = 0,
  setPolytechnicApcUnits,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
  isReviewMode = false,
  reviewOwnerName,
  onExitReviewMode,
  applyAiPlan,
}: Props) => {
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('degrees');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activePage, setActivePage] = useState<AppDestination>('home');
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
  const [selectedResetTemplate, setSelectedResetTemplate] = useState<PlanTemplate | 'scratch'>('standard');
  const [secondaryPanelsOpen, setSecondaryPanelsOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('studyplanner:sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('studyplanner:sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const navigateToPage = (destination: AppDestination) => {
    setActivePage(destination);
    setSettingsOpen(false);
    setAdvisorOpen(false);
  };

  const handleMobileDestination = (destination: MobileDestination) => {
    if (destination === 'advisor') {
      setAdvisorOpen(!advisorOpen);
      setSettingsOpen(false);
      return;
    }
    if (destination === 'settings') {
      setSettingsOpen(!settingsOpen);
      setAdvisorOpen(false);
      return;
    }
    navigateToPage(destination);
  };

  const toggleSettings = () => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    if (next) setAdvisorOpen(false);
  };

  const toggleAdvisor = () => {
    setAdvisorOpen((open) => !open);
    setSettingsOpen(false);
  };

  const openPathwaysSettings = () => {
    setSettingsSection('pathways');
    setAdvisorOpen(false);
    setSettingsOpen(true);
  };

  const reviewLabel = reviewOwnerName?.trim() || 'Shared plan';

  const handleApplyAiRecommendation = (newSemesters: StudentSemester[], minorId?: string | null) => {
    if (!applyAiPlan) return;
    applyAiPlan(newSemesters, minorId);
  };

  const copyShareLink = async (name: string) => {
    const link = buildShareLink({
      profile: { name, matricNumber, year: studentYear },
      plan: {
        majorId,
        semesters,
        waivedModules,
        doubleDegreeId,
        secondMajorId,
        minorIds,
        requirementMappings,
        nocDuration,
        specialProgrammes,
        polytechnicApcUnits: polytechnicApcUnits > 0 ? polytechnicApcUnits : undefined,
      },
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
    setSelectedResetTemplate((polytechnicApcUnits ?? 0) > 0 ? 'poly-accelerated' : 'standard');
    setShowResetConfirm(true);
  };

  const confirmResetPlan = () => {
    resetPlan(selectedResetTemplate);
    setShowResetConfirm(false);
  };

  const declaredSecondMajor = secondMajorId
    ? secondMajors.find((item) => item.id === secondMajorId) ?? null
    : null;
  const declaredMinors = minors.filter((item) => minorIds.includes(item.id));
  const declaredSecondaries = declaredSecondMajor ? [declaredSecondMajor, ...declaredMinors] : declaredMinors;
  const tripleCountedCodes = computeTripleCountedCodes(declaredSecondaries, semesters, waivedModules);
  const mobileActive: MobileDestination = settingsOpen
    ? 'settings'
    : advisorOpen
      ? 'advisor'
      : activePage;

  return (
    <>
      <div className={`planner-shell min-h-screen bg-canvas print:hidden ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="app-frame flex min-h-screen min-w-0">
          <AppSidebar
            active={activePage}
            onNavigate={navigateToPage}
            settingsOpen={settingsOpen}
            onToggleSettings={toggleSettings}
            studentName={studentName}
            majorLabel={major.label}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <header
              className={`sticky top-0 z-40 bg-canvas/90 backdrop-blur-md px-4 py-2.5 sm:px-6 transition-all duration-300 border-b border-ink/10 ${
                isScrolled ? 'shadow-xs' : 'shadow-none'
              }`}
            >
              <div className="app-header-layout max-w-[2560px] mx-auto w-full grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 min-h-[38px]">
                {/* Left Slot: current destination label (desktop only, so it never shifts the profile) */}
                <div className="flex items-center min-w-0 lg:min-w-[120px]">
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-muted lg:inline">
                    {APP_DESTINATION_LABELS[activePage]}
                  </span>
                </div>

                {/* Center Slot: Smoothly cross-fading detailed vs compact view */}
                <div className="header-profile flex flex-1 items-center justify-end lg:justify-center lg:max-w-[42vw] min-w-0 relative">
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
                    {polytechnicApcUnits > 0 && (
                      <>
                        <span className="text-muted/60 font-mono">&middot;</span>
                        <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-1 py-0.2 rounded font-medium">Poly APC</span>
                      </>
                    )}
                    <span className="text-muted/60 font-mono hidden sm:inline">&middot;</span>
                    <span className="font-semibold text-ink/80 truncate hidden sm:inline">{major.label}</span>
                  </div>
                </div>

                {/* Right Slot: utilities (navigation lives in the sidebar / compact bar) */}
                <div className="header-actions col-span-2 lg:col-span-1 flex flex-wrap items-center justify-between gap-2 border-t border-line/30 pt-2 lg:justify-end lg:border-0 lg:pt-0">
                  <button
                    type="button"
                    onClick={toggleAdvisor}
                    className={`hidden md:block lg:w-32 shrink-0 text-sm transition-colors px-3 py-2 rounded-xl font-medium ${
                      advisorOpen
                        ? 'bg-paper text-ink font-semibold'
                        : 'text-muted hover:text-ink hover:bg-paper'
                    }`}
                    title={advisorOpen ? 'Hide Study Plan Advisor' : 'Show Study Plan Advisor'}
                  >
                    <span>{advisorOpen ? 'Hide Advisor' : 'Advisor'}</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="text-sm text-muted hover:text-ink transition-colors px-3 py-2 rounded-xl hover:bg-paper"
                  >
                    Print
                  </button>
                  <button
                    onClick={handleShare}
                    className="text-sm text-muted hover:text-ink transition-colors px-3 py-2 rounded-xl hover:bg-paper"
                  >
                    {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Copy manually' : 'Share'}
                  </button>
                </div>
              </div>
            </header>

            {isReviewMode && (
              <div className="border-b border-ink/10 bg-sky-100/70 px-4 py-2 sm:px-6">
                <div className="mx-auto flex max-w-[2560px] w-full flex-wrap items-center justify-between gap-2">
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

            <div className="relative flex min-h-0 flex-1 min-w-0">
              <main className="flex min-w-0 flex-1 flex-col">
                {activePage === 'home' && (
                  <>
                    <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
                      <div className="max-w-[2560px] mx-auto w-full">
                        <StatsSummary
                          major={major}
                          stats={stats}
                          semesters={semesters}
                          waivedModules={waivedModules}
                          requirements={requirements}
                          requirementMappings={requirementMappings}
                          addRequirementMapping={addRequirementMapping}
                          removeRequirementMapping={removeRequirementMapping}
                          polytechnicApcUnits={polytechnicApcUnits}
                        />
                      </div>
                    </div>

                    {doubleDegreeId && <div className="px-4 py-4 sm:px-6"><DoubleDegreePanel id={doubleDegreeId} majorId={majorId} totalUnits={stats.totalMc} /></div>}

                    {(declaredSecondMajor || declaredMinors.length > 0) && (
                      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
                        <div className="max-w-[2560px] mx-auto w-full flex flex-col gap-4">
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

                    <div className="max-w-[2560px] mx-auto px-4 sm:px-6 py-6 w-full">
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
                  </>
                )}

                {activePage === 'visualise' && (
                  <div className="max-w-[2560px] mx-auto px-4 sm:px-6 py-6 w-full">
                    <CompetencyExplorer
                      major={major}
                      semesters={semesters}
                      waivedModules={waivedModules}
                      requirements={requirements}
                      studentYear={studentYear}
                      onClose={() => navigateToPage('home')}
                      onOpenPathways={openPathwaysSettings}
                    />
                  </div>
                )}

                {activePage === 'explore' && (
                  <div className="max-w-[2560px] mx-auto px-4 sm:px-6 py-6 w-full">
                    <ExploreGallery
                      majors={majors}
                      majorId={majorId}
                      secondMajors={secondMajors}
                      minors={minors}
                      secondMajorId={secondMajorId}
                      minorIds={minorIds}
                      specialProgrammes={specialProgrammes}
                      semesters={semesters}
                      waivedModules={waivedModules}
                      onRequestSwitchMajor={handleSwitchMajor}
                      setSecondMajorId={setSecondMajorId}
                      toggleMinorId={toggleMinorId}
                      togglePathway={togglePathway}
                    />
                  </div>
                )}
              </main>

              {/* Right Sidebar (Study Plan Advisor) */}
              <StudyPlanAdvisorSidebar
                major={major}
                minors={minors}
                semesters={semesters}
                waivedModules={waivedModules}
                studentYear={studentYear}
                isOpen={advisorOpen}
                onClose={() => setAdvisorOpen(false)}
                onApply={handleApplyAiRecommendation}
              />
            </div>
          </div>
        </div>

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          majors={majors}
          majorId={majorId}
          secondMajors={secondMajors}
          minors={minors}
          doubleDegreeId={doubleDegreeId}
          setDoubleDegreeId={setDoubleDegreeId}
          secondMajorId={secondMajorId}
          minorIds={minorIds}
          setSecondMajorId={setSecondMajorId}
          toggleMinorId={toggleMinorId}
          nocDuration={nocDuration}
          specialProgrammes={specialProgrammes}
          togglePathway={togglePathway}
          activeSection={settingsSection}
          onSectionChange={setSettingsSection}
          polytechnicApcUnits={polytechnicApcUnits}
          setPolytechnicApcUnits={setPolytechnicApcUnits}
          studentName={studentName}
          setStudentName={setStudentName}
          matricNumber={matricNumber}
          setMatricNumber={setMatricNumber}
          studentYear={studentYear}
          setStudentYear={setStudentYear}
          onSwitchMajor={handleSwitchMajor}
          onResetPlan={handleResetPlan}
        />

        <MobileNavigation active={mobileActive} onChange={handleMobileDestination} />

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
            title="Load Sample Plan"
            onClose={() => setShowResetConfirm(false)}
            actions={[
              { label: 'Cancel', onClick: () => setShowResetConfirm(false), variant: 'secondary' },
              { label: 'Load Plan', onClick: confirmResetPlan, variant: 'primary' },
            ]}
          >
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-muted">
                Select a sample plan for <span className="font-semibold text-ink">{major.label}</span>.
              </p>

              <div className="flex flex-col gap-2">
                {[
                  {
                    id: 'poly-accelerated' as const,
                    title: 'Polytechnic (3.5 Years)',
                    desc: 'Accelerated 7-semester plan.',
                  },
                  {
                    id: 'poly-balanced' as const,
                    title: 'Polytechnic (4 Years)',
                    desc: 'Balanced 8-semester plan.',
                  },
                  {
                    id: 'standard' as const,
                    title: 'Standard (4 Years)',
                    desc: 'Standard 8-semester direct entry plan.',
                  },
                  {
                    id: 'scratch' as const,
                    title: 'Blank Slate',
                    desc: 'Clear all non-compulsory modules.',
                  },
                ].filter(option => option.id === 'scratch' || (polytechnicApcUnits > 0 ? option.id.startsWith('poly-') : option.id === 'standard')).map((option) => {
                  const isSelected = selectedResetTemplate === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedResetTemplate(option.id)}
                      className={`flex flex-col gap-0.5 rounded-xl p-3 text-left transition-all border ${
                        isSelected
                          ? 'border-ink bg-paper shadow-xs ring-1 ring-ink/20 font-medium'
                          : 'border-line/40 bg-canvas/40 hover:bg-paper hover:border-line'
                      }`}
                    >
                      <span className="text-xs font-semibold text-ink">
                        {option.title}
                      </span>
                      <p className="text-[11px] text-muted">
                        {option.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
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
        doubleDegreeId={doubleDegreeId}
        secondMajorId={secondMajorId}
        minorIds={minorIds}
        nocDuration={nocDuration}
        specialProgrammes={specialProgrammes}
        polytechnicApcUnits={polytechnicApcUnits}
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
