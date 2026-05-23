import { useState } from 'react';
import type { Major } from '@shared/types';
import { MajorBuilder } from './components/MajorBuilder';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });

const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

const newMajor = (): Major => ({
  id: `major-${Date.now()}`,
  label: 'New Major',
  school: '',
  totalMcTarget: 160,
  categories: [
    { id: 'primary-major', label: 'Primary Major', mcTarget: 80, color: '#d4c9b8' },
    { id: 'unrestricted-electives', label: 'Unrestricted Electives', color: '#c3bace' },
  ],
  requirements: [],
  moduleCatalog: {},
  defaultPlan: [],
});

const App = () => {
  const [majors, setMajors] = useState<Major[]>(loadMajors);
  const [selectedId, setSelectedId] = useState<string | null>(majors[0]?.id ?? null);

  const selectedMajor = majors.find((m) => m.id === selectedId) ?? null;

  const handleCreate = () => {
    const m = newMajor();
    setMajors((prev) => [...prev, m]);
    setSelectedId(m.id);
  };

  const handleChange = (updated: Major) => {
    setMajors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-semibold text-ink">SOC Study Planner — Admin</h1>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
          >
            + New Major
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar: major list */}
        <aside className="w-52 flex-shrink-0 flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wide text-muted px-1">Majors</p>
          {majors.length === 0 && (
            <p className="text-xs text-muted italic px-1">No majors yet. Create one.</p>
          )}
          {majors.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className="text-left rounded-2xl px-4 py-3 text-sm transition-colors"
              style={{
                backgroundColor: selectedId === m.id ? 'rgb(20,20,19)' : 'rgb(225,218,205)',
                color: selectedId === m.id ? 'rgb(239,238,231)' : 'rgb(20,20,19)',
              }}
            >
              <div className="font-medium">{m.label}</div>
              {m.specialisation && (
                <div
                  className="text-[10px] mt-0.5 truncate"
                  style={{ color: selectedId === m.id ? 'rgba(239,238,231,0.6)' : 'rgb(108,107,104)' }}
                >
                  {m.specialisation}
                </div>
              )}
            </button>
          ))}
        </aside>

        {/* Main: major builder */}
        <main className="flex-1 min-w-0">
          {selectedMajor ? (
            <MajorBuilder major={selectedMajor} onChange={handleChange} />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted text-sm">
              Select or create a major to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
