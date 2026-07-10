import { useState } from 'react';
import type { Major, SecondaryProgramme } from '@shared/types';
import { MajorBuilder } from './components/MajorBuilder';
import { SecondaryProgrammeBuilder } from './components/SecondaryProgrammeBuilder';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });
const secondMajorModules = import.meta.glob('../../shared/data/second-majors/*.json', { eager: true });
const minorModules = import.meta.glob('../../shared/data/minors/*.json', { eager: true });

const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

const loadSecondMajors = (): SecondaryProgramme[] =>
  Object.values(secondMajorModules).map((m) => (m as { default: SecondaryProgramme }).default);

const loadMinors = (): SecondaryProgramme[] =>
  Object.values(minorModules).map((m) => (m as { default: SecondaryProgramme }).default);

const newMajor = (): Major => ({
  id: `major-${Date.now()}`,
  label: 'New Major',
  school: '',
  batches: ['AY2026/2027'],
  totalMcTarget: 160,
  categories: [
    { id: 'primary-major', label: 'Primary Major', mcTarget: 80, color: '#d4c9b8' },
    { id: 'unrestricted-electives', label: 'Unrestricted Electives', color: '#c3bace' },
  ],
  requirements: [],
  moduleCatalog: {},
  defaultPlan: [],
});

const newSecondaryProgramme = (kind: SecondaryProgramme['kind']): SecondaryProgramme => ({
  id: `${kind}-${Date.now()}`,
  label: kind === 'second-major' ? 'New Second Major' : 'New Minor',
  kind,
  mcTarget: kind === 'second-major' ? 40 : 20,
  requirements: [],
  moduleCatalog: {},
});

type Kind = 'major' | 'second-major' | 'minor';

const App = () => {
  const [majors, setMajors] = useState<Major[]>(loadMajors);
  const [secondMajors, setSecondMajors] = useState<SecondaryProgramme[]>(loadSecondMajors);
  const [minors, setMinors] = useState<SecondaryProgramme[]>(loadMinors);
  const [kind, setKind] = useState<Kind>('major');
  const [selectedId, setSelectedId] = useState<string | null>(majors[0]?.id ?? null);

  const secondaryList = kind === 'second-major' ? secondMajors : minors;
  const sidebarItems: { id: string; label: string; specialisation?: string }[] =
    kind === 'major' ? majors : secondaryList;

  const handleCreate = () => {
    if (kind === 'major') {
      const m = newMajor();
      setMajors((prev) => [...prev, m]);
      setSelectedId(m.id);
      return;
    }
    const p = newSecondaryProgramme(kind);
    if (kind === 'second-major') setSecondMajors((prev) => [...prev, p]);
    else setMinors((prev) => [...prev, p]);
    setSelectedId(p.id);
  };

  const handleSwitchKind = (next: Kind) => {
    setKind(next);
    const list = next === 'major' ? majors : next === 'second-major' ? secondMajors : minors;
    setSelectedId(list[0]?.id ?? null);
  };

  const handleChangeMajor = (updated: Major) => {
    setMajors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleChangeSecondary = (updated: SecondaryProgramme) => {
    if (updated.kind === 'second-major') {
      setSecondMajors((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      setMinors((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const selectedMajor = kind === 'major' ? majors.find((m) => m.id === selectedId) ?? null : null;
  const selectedSecondary = kind !== 'major' ? secondaryList.find((p) => p.id === selectedId) ?? null : null;

  const kindTabs: { id: Kind; label: string }[] = [
    { id: 'major', label: 'Majors' },
    { id: 'second-major', label: 'Second Majors' },
    { id: 'minor', label: 'Minors' },
  ];
  const createLabel = kind === 'major' ? 'Major' : kind === 'second-major' ? 'Second Major' : 'Minor';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-semibold text-ink">SOC Study Planner — Admin</h1>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
          >
            + New {createLabel}
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
        <aside className="w-52 flex-shrink-0 flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl bg-paper p-1">
            {kindTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSwitchKind(t.id)}
                className="rounded-xl px-3 py-1.5 text-left text-sm font-medium transition-colors"
                style={{
                  backgroundColor: kind === t.id ? 'rgb(20,20,19)' : 'transparent',
                  color: kind === t.id ? 'rgb(239,238,231)' : 'rgb(108,107,104)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-muted px-1">
              {kindTabs.find((t) => t.id === kind)?.label}
            </p>
            {sidebarItems.length === 0 && (
              <p className="text-xs text-muted italic px-1">None yet. Create one.</p>
            )}
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="text-left rounded-2xl px-4 py-3 text-sm transition-colors"
                style={{
                  backgroundColor: selectedId === item.id ? 'rgb(20,20,19)' : 'rgb(225,218,205)',
                  color: selectedId === item.id ? 'rgb(239,238,231)' : 'rgb(20,20,19)',
                }}
              >
                <div className="font-medium">{item.label}</div>
                {item.specialisation && (
                  <div
                    className="text-[10px] mt-0.5 truncate"
                    style={{ color: selectedId === item.id ? 'rgba(239,238,231,0.6)' : 'rgb(108,107,104)' }}
                  >
                    {item.specialisation}
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {kind === 'major' && selectedMajor && (
            <MajorBuilder major={selectedMajor} onChange={handleChangeMajor} />
          )}
          {kind !== 'major' && selectedSecondary && (
            <SecondaryProgrammeBuilder programme={selectedSecondary} onChange={handleChangeSecondary} />
          )}
          {!selectedMajor && !selectedSecondary && (
            <div className="flex items-center justify-center h-64 text-muted text-sm">
              Select or create an entry to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
