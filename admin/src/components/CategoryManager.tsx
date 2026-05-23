import { useState } from 'react';
import type { MajorCategory } from '@shared/types';

interface Props {
  categories: MajorCategory[];
  onChange: (categories: MajorCategory[]) => void;
}

const PRESET_COLORS = ['#d4c9b8', '#c6d0ca', '#abb89b', '#c3bace', '#b8c9d4', '#d4b8c9', '#c9d4b8'];

export const CategoryManager = ({ categories, onChange }: Props) => {
  const [newLabel, setNewLabel] = useState('');

  const addCategory = () => {
    const label = newLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (categories.find((c) => c.id === id)) return;
    const color = PRESET_COLORS[categories.length % PRESET_COLORS.length];
    onChange([...categories, { id, label, color }]);
    setNewLabel('');
  };

  const updateCategory = (idx: number, patch: Partial<MajorCategory>) => {
    onChange(categories.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCategory = (idx: number) => {
    onChange(categories.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Categories</h3>

      <div className="flex flex-col gap-2">
        {categories.map((cat, idx) => (
          <div key={cat.id} className="flex items-center gap-2 rounded-xl bg-paper p-2">
            <input
              type="color"
              value={cat.color}
              onChange={(e) => updateCategory(idx, { color: e.target.value })}
              className="w-7 h-7 rounded-lg border-0 cursor-pointer p-0"
              title="Category color"
            />
            <input
              type="text"
              value={cat.label}
              onChange={(e) => updateCategory(idx, { label: e.target.value })}
              className="flex-1 bg-transparent text-sm text-ink focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted">MC target:</span>
              <input
                type="number"
                min="0"
                value={cat.mcTarget ?? ''}
                placeholder="—"
                onChange={(e) =>
                  updateCategory(idx, {
                    mcTarget: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                className="w-14 bg-transparent text-sm text-ink text-right focus:outline-none"
              />
            </div>
            <button
              onClick={() => removeCategory(idx)}
              className="text-muted hover:text-ink text-lg leading-none transition-colors"
              title="Remove category"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          placeholder="New category name…"
          className="flex-1 rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button
          onClick={addCategory}
          disabled={!newLabel.trim()}
          className="rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
};
