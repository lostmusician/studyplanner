import { useState, useRef, useEffect } from 'react';
import type { Major, PlacedModule } from '@shared/types';
import { searchNusModsModules, fetchNusModsModuleDetail } from '@shared/nusmods';
import type { NusModsModuleSummary } from '@shared/nusmods';

interface Props {
  major: Major;
  onAdd: (year: number, sem: number, module: PlacedModule) => void;
}

interface FormState {
  query: string;
  code: string;
  name: string;
  mcs: string;
  categoryId: string;
  year: string;
  sem: string;
}

export const AddModuleForm = ({ major, onAdd }: Props) => {
  const [form, setForm] = useState<FormState>({
    query: '',
    code: '',
    name: '',
    mcs: '4',
    categoryId: major.categories[0]?.id ?? '',
    year: '1',
    sem: '1',
  });
  const [suggestions, setSuggestions] = useState<NusModsModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleQueryChange = (value: string) => {
    setForm((f) => ({ ...f, query: value, code: value.toUpperCase(), name: '', mcs: '4' }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { items } = await searchNusModsModules(value, 8);
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (item: NusModsModuleSummary) => {
    setShowSuggestions(false);
    setLoading(true);
    try {
      const { detail } = await fetchNusModsModuleDetail(item.moduleCode, item.acadYear);
      setForm((f) => ({
        ...f,
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
        mcs: detail.moduleCredit ?? '4',
      }));
    } catch {
      setForm((f) => ({
        ...f,
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim() || code;
    const mcs = parseInt(form.mcs, 10) || 4;
    const year = parseInt(form.year, 10);
    const sem = parseInt(form.sem, 10);
    if (!code || !form.categoryId || !year || !sem) return;

    onAdd(year, sem, { code, name, mcs, categoryId: form.categoryId });
    setForm((f) => ({ ...f, query: '', code: '', name: '', mcs: '4' }));
  };

  const field =
    'rounded-2xl bg-paper border border-ink/10 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <form onSubmit={handleSubmit} className="rounded-4xl bg-paper p-5 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-ink">Add Module</h2>

      <div ref={containerRef} className="relative">
        <input
          type="text"
          placeholder="Search module code or title…"
          value={form.query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          className={field}
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">…</span>
        )}
        {showSuggestions && (
          <ul className="absolute z-40 top-full mt-1 left-0 right-0 bg-ink rounded-2xl overflow-hidden shadow-soft max-h-60 overflow-y-auto">
            {suggestions.map((item) => (
              <li key={item.moduleCode}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-canvas/10 transition-colors"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <span className="text-xs font-mono font-bold text-canvas">{item.moduleCode}</span>
                  <span className="text-xs text-canvas/60 ml-2 truncate">{item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form.name && (
        <div className="rounded-2xl bg-canvas/50 px-3 py-2 text-xs text-ink/70 leading-snug">
          {form.name}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted">MCs</label>
          <input
            type="number"
            min="1"
            max="20"
            value={form.mcs}
            onChange={(e) => setForm((f) => ({ ...f, mcs: e.target.value }))}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted">Year</label>
          <select
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            className={field}
          >
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>Y{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted">Sem</label>
          <select
            value={form.sem}
            onChange={(e) => setForm((f) => ({ ...f, sem: e.target.value }))}
            className={field}
          >
            <option value="1">S1</option>
            <option value="2">S2</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted">Category</label>
        <select
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          className={field}
        >
          {major.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-2xl bg-ink text-canvas px-4 py-2.5 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-40"
        disabled={!form.code.trim()}
      >
        Add to Plan
      </button>
    </form>
  );
};
