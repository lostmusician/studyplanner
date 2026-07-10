import { useState } from 'react';
import type { Module, RequirementRule, SecondaryProgramme } from '@shared/types';
import { ModuleSearch } from './ModuleSearch';
import { ExportPanel } from './ExportPanel';

interface Props {
  programme: SecondaryProgramme;
  onChange: (programme: SecondaryProgramme) => void;
}

type Tab = 'info' | 'requirements' | 'catalog' | 'export';

export const SecondaryProgrammeBuilder = ({ programme, onChange }: Props) => {
  const [tab, setTab] = useState<Tab>('info');

  const update = (patch: Partial<SecondaryProgramme>) => onChange({ ...programme, ...patch });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'catalog', label: 'Module Catalog' },
    { id: 'export', label: 'Export' },
  ];

  const field =
    'rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-2xl bg-paper p-1 self-start">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.id ? 'rgb(20,20,19)' : 'transparent',
              color: tab === t.id ? 'rgb(239,238,231)' : 'rgb(108,107,104)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-paper p-5">
        {tab === 'info' && (
          <div className="flex flex-col gap-4 max-w-md">
            <h3 className="text-sm font-semibold text-ink">Programme Info</h3>
            <LabeledField label="Label">
              <input value={programme.label} onChange={(e) => update({ label: e.target.value })} className={field} />
            </LabeledField>
            <LabeledField label="Kind">
              <select
                value={programme.kind}
                onChange={(e) => update({ kind: e.target.value as SecondaryProgramme['kind'] })}
                className={field}
              >
                <option value="second-major">Second Major</option>
                <option value="minor">Minor</option>
              </select>
            </LabeledField>
            <LabeledField label="MC Target">
              <input
                type="number"
                value={programme.mcTarget}
                onChange={(e) => update({ mcTarget: parseInt(e.target.value, 10) || 0 })}
                className={field}
              />
            </LabeledField>
          </div>
        )}

        {tab === 'requirements' && (
          <RequirementsEditor
            requirements={programme.requirements}
            onChange={(requirements) => update({ requirements })}
          />
        )}

        {tab === 'catalog' && (
          <CatalogEditor
            catalog={programme.moduleCatalog}
            onChange={(moduleCatalog) => update({ moduleCatalog })}
          />
        )}

        {tab === 'export' && (
          <ExportPanel
            data={programme}
            directory={programme.kind === 'second-major' ? 'second-majors' : 'minors'}
          />
        )}
      </div>
    </div>
  );
};

const LabeledField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-muted uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const RequirementsEditor = ({
  requirements,
  onChange,
}: {
  requirements: RequirementRule[];
  onChange: (r: RequirementRule[]) => void;
}) => {
  const [newName, setNewName] = useState('');
  const [newCodes, setNewCodes] = useState('');
  const [newCount, setNewCount] = useState('1');

  const addReq = () => {
    const name = newName.trim();
    if (!name) return;
    const fulfilledBy = newCodes
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const count = parseInt(newCount, 10) || 1;
    onChange([...requirements, { name, fulfilledBy, count }]);
    setNewName('');
    setNewCodes('');
    setNewCount('1');
  };

  const removeReq = (idx: number) => onChange(requirements.filter((_, i) => i !== idx));

  const field =
    'rounded-xl border border-ink/20 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Requirements</h3>

      <div className="flex flex-col gap-2">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="flex-1">
              <div className="text-sm text-ink">
                {req.name}
                {(req.count ?? 1) > 1 && <span className="ml-2 text-xs text-muted">needs {req.count}</span>}
              </div>
              <div className="text-xs text-muted font-mono mt-0.5">{req.fulfilledBy.join(', ')}</div>
            </div>
            <button onClick={() => removeReq(idx)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
        ))}
        {requirements.length === 0 && <p className="text-xs text-muted italic">No requirements yet.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
        <p className="text-xs text-muted font-medium">Add requirement</p>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Requirement name…" className={field} />
        <input
          value={newCodes}
          onChange={(e) => setNewCodes(e.target.value)}
          placeholder="Module codes (comma-separated, e.g. ST1131, ST32*)"
          className={field}
        />
        <LabeledField label="Distinct modules needed">
          <input type="number" min={1} value={newCount} onChange={(e) => setNewCount(e.target.value)} className={field} />
        </LabeledField>
        <button
          onClick={addReq}
          disabled={!newName.trim()}
          className="self-start rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
};

const CatalogEditor = ({
  catalog,
  onChange,
}: {
  catalog: Record<string, Module>;
  onChange: (catalog: Record<string, Module>) => void;
}) => {
  const handleAdd = (module: Module) => {
    if (catalog[module.code]) return;
    onChange({ ...catalog, [module.code]: module });
  };

  const handleRemove = (code: string) => {
    const next = { ...catalog };
    delete next[code];
    onChange(next);
  };

  const modules = Object.values(catalog).sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h3 className="text-sm font-semibold text-ink">Module Catalog</h3>
      <ModuleSearch onSelect={handleAdd} placeholder="Add module…" />
      <div className="flex flex-col gap-1.5">
        {modules.map((m) => (
          <div key={m.code} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="flex-1">
              <span className="font-mono text-xs font-bold text-ink">{m.code}</span>
              <span className="ml-2 text-xs text-muted">{m.name}</span>
            </div>
            <span className="text-xs text-muted">{m.mcs} MC</span>
            <button onClick={() => handleRemove(m.code)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
        ))}
        {modules.length === 0 && <p className="text-xs text-muted italic">No modules in catalog yet.</p>}
      </div>
    </div>
  );
};
