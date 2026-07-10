import type { Major, Module, DefaultPlanEntry, MajorCategory, RequirementRule } from '@shared/types';
import { CategoryManager } from './CategoryManager';
import { PlanSeeder } from './PlanSeeder';
import { ExportPanel } from './ExportPanel';
import { useState } from 'react';

interface Props {
  major: Major;
  onChange: (major: Major) => void;
}

type Tab = 'info' | 'categories' | 'plan' | 'requirements' | 'export';

export const MajorBuilder = ({ major, onChange }: Props) => {
  const [tab, setTab] = useState<Tab>('info');

  const update = (patch: Partial<Major>) => onChange({ ...major, ...patch });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'categories', label: 'Categories' },
    { id: 'plan', label: 'Default Plan' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'export', label: 'Export' },
  ];

  const field =
    'rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar */}
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

      {/* Tab content */}
      <div className="rounded-2xl bg-paper p-5">
        {tab === 'info' && (
          <div className="flex flex-col gap-4 max-w-md">
            <h3 className="text-sm font-semibold text-ink">Major Info</h3>
            <LabeledField label="Major Label">
              <input value={major.label} onChange={(e) => update({ label: e.target.value })} className={field} />
            </LabeledField>
            <LabeledField label="School">
              <input value={major.school} onChange={(e) => update({ school: e.target.value })} className={field} />
            </LabeledField>
            <LabeledField label="Specialisation (optional)">
              <input
                value={major.specialisation ?? ''}
                onChange={(e) => update({ specialisation: e.target.value || undefined })}
                className={field}
                placeholder="e.g. Networking and Distributed Systems"
              />
            </LabeledField>
            <LabeledField label="Batches (comma-separated)">
              <input
                value={major.batches.join(', ')}
                onChange={(e) =>
                  update({
                    batches: e.target.value
                      .split(',')
                      .map((b) => b.trim())
                      .filter(Boolean),
                  })
                }
                className={field}
                placeholder="e.g. AY2026/2027"
              />
            </LabeledField>
            <LabeledField label="Total MC Target">
              <input
                type="number"
                value={major.totalMcTarget}
                onChange={(e) => update({ totalMcTarget: parseInt(e.target.value, 10) || 160 })}
                className={field}
              />
            </LabeledField>
          </div>
        )}

        {tab === 'categories' && (
          <CategoryManager
            categories={major.categories}
            onChange={(categories: MajorCategory[]) => update({ categories })}
          />
        )}

        {tab === 'plan' && (
          <PlanSeeder
            major={major}
            onUpdateCatalog={(catalog: Record<string, Module>) => update({ moduleCatalog: catalog })}
            onUpdatePlan={(plan: DefaultPlanEntry[]) => update({ defaultPlan: plan })}
          />
        )}

        {tab === 'requirements' && (
          <RequirementsEditor
            requirements={major.requirements}
            onChange={(requirements: RequirementRule[]) => update({ requirements })}
          />
        )}

        {tab === 'export' && <ExportPanel data={major} directory="majors" />}
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

  const addReq = () => {
    const name = newName.trim();
    if (!name) return;
    const fulfilledBy = newCodes
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    onChange([...requirements, { name, fulfilledBy }]);
    setNewName('');
    setNewCodes('');
  };

  const removeReq = (idx: number) => onChange(requirements.filter((_, i) => i !== idx));

  const field =
    'rounded-xl border border-ink/20 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20';

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Requirements</h3>

      <div className="flex flex-col gap-2">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="flex-1">
              <div className="text-sm text-ink">{req.name}</div>
              <div className="text-xs text-muted font-mono mt-0.5">{req.fulfilledBy.join(', ')}</div>
            </div>
            <button onClick={() => removeReq(idx)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
        ))}
        {requirements.length === 0 && <p className="text-xs text-muted italic">No requirements yet.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
        <p className="text-xs text-muted font-medium">Add requirement</p>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Requirement name…" className={field + ' w-full'} />
        <input
          value={newCodes}
          onChange={(e) => setNewCodes(e.target.value)}
          placeholder="Module codes (comma-separated, e.g. CS1101S, CS1231)"
          className={field + ' w-full'}
        />
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
