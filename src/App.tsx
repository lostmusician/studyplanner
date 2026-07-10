import { useEffect, useState } from 'react';
import { useStudyPlan } from './hooks/useStudyPlan';
import { useProfile } from './hooks/useProfile';
import { useOnboarding } from './hooks/useOnboarding';
import { StudyPlan } from './components/StudyPlan';
import { ImportModal } from './components/ImportModal';
import { OnboardingModal } from './components/OnboardingModal';
import {
  readImportFromHash,
  IMPORT_HASH_KEY,
  SHORT_IMPORT_HASH_KEY,
  type SharePayload,
  type ShareProfile,
} from '@shared/share';

const clearImportHash = () => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
};

const App = () => {
  const plan = useStudyPlan();
  const { profile, setName, setMatricNumber, setYear, importProfile } = useProfile();
  const onboarding = useOnboarding(plan.majors);
  const [pendingImport, setPendingImport] = useState<SharePayload | null>(null);
  const [reviewProfile, setReviewProfile] = useState<ShareProfile | null>(null);
  const [importError, setImportError] = useState(false);
  const hasImportInHash =
    window.location.hash.includes(`${IMPORT_HASH_KEY}=`) ||
    window.location.hash.includes(`${SHORT_IMPORT_HASH_KEY}=`);

  useEffect(() => {
    const hasImport =
      window.location.hash.includes(`${IMPORT_HASH_KEY}=`) ||
      window.location.hash.includes(`${SHORT_IMPORT_HASH_KEY}=`);
    if (!hasImport) return;
    const payload = readImportFromHash(window.location.hash);
    if (payload) setPendingImport(payload);
    else setImportError(true);
    // Clear the hash either way so a refresh doesn't retry the import.
    clearImportHash();
  }, []);

  const confirmImport = () => {
    if (!pendingImport) return;
    const ok = plan.importSharedPlan(
      pendingImport.plan.majorId,
      pendingImport.plan.semesters,
      pendingImport.plan.waivedModules,
      pendingImport.plan.secondMajorId ?? null,
      pendingImport.plan.minorIds ?? [],
      pendingImport.plan.requirementMappings ?? {},
      pendingImport.plan.nocDuration ?? null,
    );
    if (ok) {
      importProfile(pendingImport.profile);
      setReviewProfile(null);
      onboarding.dismissOnboarding();
    }
    setPendingImport(null);
  };

  const openReviewImport = () => {
    if (!pendingImport) return;
    const ok = plan.openReviewPlan(
      pendingImport.plan.majorId,
      pendingImport.plan.semesters,
      pendingImport.plan.waivedModules,
      pendingImport.plan.secondMajorId ?? null,
      pendingImport.plan.minorIds ?? [],
      pendingImport.plan.requirementMappings ?? {},
      pendingImport.plan.nocDuration ?? null,
    );
    if (ok) {
      setReviewProfile(pendingImport.profile);
      setPendingImport(null);
      onboarding.dismissOnboarding();
    }
  };

  const exitReviewMode = () => {
    plan.exitReviewMode();
    setReviewProfile(null);
  };

  if (!plan.major) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas text-ink">
        No majors configured.
      </div>
    );
  }

  const pendingMajorLabel = pendingImport
    ? plan.majors.find((m) => m.id === pendingImport.plan.majorId)?.label ?? null
    : null;
  const isReviewMode = plan.isReviewMode && reviewProfile !== null;
  const showOnboarding = onboarding.needsOnboarding && !hasImportInHash && !pendingImport && !isReviewMode;
  const displayedProfile = isReviewMode ? reviewProfile : profile;
  const setDisplayedName = isReviewMode
    ? (name: string) => setReviewProfile((current) => current ? { ...current, name } : current)
    : setName;
  const setDisplayedMatricNumber = isReviewMode
    ? (matricNumber: string) => setReviewProfile((current) => current ? { ...current, matricNumber } : current)
    : setMatricNumber;
  const setDisplayedYear = isReviewMode
    ? (year: string) => setReviewProfile((current) => current ? { ...current, year } : current)
    : setYear;

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          majors={plan.majors}
          hasExistingPlan={onboarding.hasExistingPlan}
          onChooseExample={(majorId) => {
            plan.applyOnboardingChoice(majorId, 'example');
            onboarding.dismissOnboarding();
          }}
          onChooseScratch={(majorId) => {
            plan.applyOnboardingChoice(majorId, 'scratch');
            onboarding.dismissOnboarding();
          }}
          onKeepCurrent={onboarding.dismissOnboarding}
        />
      )}
      <StudyPlan
        {...plan}
        studentName={displayedProfile.name}
        setStudentName={setDisplayedName}
        matricNumber={displayedProfile.matricNumber}
        setMatricNumber={setDisplayedMatricNumber}
        studentYear={displayedProfile.year}
        setStudentYear={setDisplayedYear}
        isReviewMode={isReviewMode}
        reviewOwnerName={reviewProfile?.name}
        onExitReviewMode={exitReviewMode}
      />
      {pendingImport && (
        <ImportModal
          payload={pendingImport}
          majorLabel={pendingMajorLabel}
          onConfirm={confirmImport}
          onReview={openReviewImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
      {importError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-lg">
          <span>Couldn&apos;t read this share link.</span>
          <button
            type="button"
            onClick={() => setImportError(false)}
            className="ml-3 font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
};

export default App;
