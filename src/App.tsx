import { useEffect, useState } from 'react';
import { useStudyPlan } from './hooks/useStudyPlan';
import { useProfile } from './hooks/useProfile';
import { StudyPlan } from './components/StudyPlan';
import { ImportModal } from './components/ImportModal';
import { readImportFromHash, IMPORT_HASH_KEY, type SharePayload } from '@shared/share';

const clearImportHash = () => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
};

const App = () => {
  const plan = useStudyPlan();
  const { profile, setName, setMatricNumber, setYear, importProfile } = useProfile();
  const [pendingImport, setPendingImport] = useState<SharePayload | null>(null);
  const [importError, setImportError] = useState(false);

  useEffect(() => {
    const hasImport = window.location.hash.includes(`${IMPORT_HASH_KEY}=`);
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
    );
    if (ok) importProfile(pendingImport.profile);
    setPendingImport(null);
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

  return (
    <>
      <StudyPlan
        {...plan}
        studentName={profile.name}
        setStudentName={setName}
        matricNumber={profile.matricNumber}
        setMatricNumber={setMatricNumber}
        studentYear={profile.year}
        setStudentYear={setYear}
      />
      {pendingImport && (
        <ImportModal
          payload={pendingImport}
          majorLabel={pendingMajorLabel}
          onConfirm={confirmImport}
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
