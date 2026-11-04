import { useState, useRef, useEffect } from 'react';
import type { Major, WaivedModule } from '@shared/types';
import { searchNusModsModules, fetchNusModsModuleDetail } from '@shared/nusmods';
import type { NusModsModuleSummary } from '@shared/nusmods';
import { PlusIcon, XIcon } from './Icons';
import { FOCUS_RING } from '../lib/colors';

interface Props {
  major: Major;
  waivedModules: WaivedModule[];
  onAdd: (module: WaivedModule) => void;
  onDelete: (code: string) => void;
  fullWidth?: boolean;
  layoutMode?: 'columns' | 'rows';
}

interface FormState {
  query: string;
  code: string;
  name: string;
  mcs: string;
}

export const WaivedCourses = ({ major, waivedModules, onAdd, onDelete, fullWidth = false, layoutMode = 'columns' }: Props) => {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>({ query: '', code: '', name: '', mcs: '0' });
  const [suggestions, setSuggestions] = useState<NusModsModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleQueryChange = (value: string) => {
    setForm({ query: value, code: value.toUpperCase(), name: '', mcs: '0' });
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
      setForm({
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
        mcs: detail.moduleCredit ?? '0',
      });
    } catch {
      setForm({ query: item.moduleCode, code: item.moduleCode, name: item.title, mcs: '0' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ query: '', code: '', name: '', mcs: '0' });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const moduleCode = form.code.trim().toUpperCase();
    if (!moduleCode) return;

    const catalogModule = major.moduleCatalog[moduleCode];
    onAdd({
      code: moduleCode,
      name: form.name.trim() || catalogModule?.name || moduleCode,
      mcs: parseInt(form.mcs, 10) || catalogModule?.mcs || 0,
      categoryId: inferCategoryId(major, moduleCode),
    });
    resetForm();
    setIsAdding(false);
  };

  const renderModuleCard = (module: WaivedModule) => {
    const category = major.categories.find((cat) => cat.id === module.categoryId);
    return (
      <div
        key={module.code}
        className="relative group rounded-xl p-2.5 flex-shrink-0 w-[155px]"
        style={{ backgroundColor: category?.color ?? '#d4c9b8' }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="font-mono text-xs font-bold text-ink leading-tight">{module.code}</span>
        </div>
        <p className="text-[10px] sm:text-[11px] text-ink/75 leading-tight mt-0.5 line-clamp-2">{module.name}</p>
        <div className="flex items-center justify-between mt-1 font-mono text-[9px]">
          <span className="text-ink/80 font-semibold">Waived</span>
          {category && (
            <span className="text-ink/70 font-sans truncate max-w-[65px] font-medium">{category.label}</span>
          )}
        </div>
        <button
          type="button"
          className={`absolute z-40 top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${FOCUS_RING}`}
          onClick={() => onDelete(module.code)}
          aria-label={`Remove waived ${module.code}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
    );
  };

  if (layoutMode === 'rows') {
    return (
      <div className="flex flex-col rounded-2xl p-2.5 w-full bg-[#e1dacd]">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-ink">Waived Courses</span>
          <button
            type="button"
            onClick={() => setIsAdding((open) => !open)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink transition-colors hover:bg-ink/80"
            aria-label={isAdding ? 'Close waived course search' : 'Add waived course'}
          >
            {isAdding ? <XIcon /> : <PlusIcon />}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="relative rounded-2xl bg-canvas/60 p-2 mb-2" ref={containerRef}>
            <input
              type="text"
              value={form.query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Course code"
              className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              autoComplete="off"
            />
            {form.name && (
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted">{form.name}</p>
            )}
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-canvas disabled:opacity-40"
              disabled={!form.code.trim()}
            >
              Add
            </button>
          </form>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-stretch min-h-[75px]">
          {waivedModules.map(renderModuleCard)}
          {waivedModules.length === 0 && !isAdding && (
            <div className="flex items-center justify-center w-full py-3 text-center border border-dashed border-ink/15 rounded-xl">
              <p className="text-[10px] text-muted">No waived courses. Tap + to add one.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-shrink-0 flex-1 rounded-2xl p-2.5 h-full min-h-full"
      style={{
        minWidth: fullWidth ? undefined : '160px',
        width: fullWidth ? '100%' : '160px',
        backgroundColor: 'rgb(225,218,205)',
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-ink">Waived</span>
        <button
          type="button"
          onClick={() => setIsAdding((open) => !open)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink transition-colors hover:bg-ink/80"
          aria-label={isAdding ? 'Close waived course search' : 'Add waived course'}
          aria-expanded={isAdding}
        >
          {isAdding ? <XIcon /> : <PlusIcon />}
        </button>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {isAdding && (
          <form onSubmit={handleSubmit} className="relative rounded-2xl bg-canvas/60 p-2" ref={containerRef}>
            <input
              type="text"
              value={form.query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Course code"
              className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              autoComplete="off"
            />
            {loading && (
              <span className="absolute right-4 top-4 text-muted text-xs">...</span>
            )}
            {form.name && (
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted">{form.name}</p>
            )}
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-canvas transition-colors hover:bg-ink/80 disabled:opacity-40"
              disabled={!form.code.trim()}
            >
              Add
            </button>

            {showSuggestions && (
              <ul className="absolute z-40 top-full mt-1 left-0 right-0 bg-ink rounded-2xl overflow-hidden shadow-soft max-h-60 overflow-y-auto">
                {suggestions.map((item) => (
                  <li key={item.moduleCode}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-canvas/10 transition-colors"
                      onClick={() => handleSelectSuggestion(item)}
                    >
                      <span className="block text-xs font-mono font-bold text-canvas">{item.moduleCode}</span>
                      <span className="block truncate text-[10px] text-canvas/60">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}

        {waivedModules.map((module) => {
          const category = major.categories.find((cat) => cat.id === module.categoryId);
          return (
            <div
              key={module.code}
              className="relative group rounded-xl p-2.5"
              style={{ backgroundColor: category?.color ?? '#d4c9b8' }}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-mono text-xs font-bold text-ink leading-tight">{module.code}</span>
              </div>
              <p className="text-[11px] text-ink/70 leading-snug mt-0.5 line-clamp-2">{module.name}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-ink/80">Waived</span>
                {category && (
                  <span className="text-[10px] text-ink/80 truncate max-w-[80px]">{category.label}</span>
                )}
              </div>
              <button
                type="button"
                className={`absolute z-40 top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${FOCUS_RING}`}
                onClick={() => onDelete(module.code)}
                aria-label={`Remove waived ${module.code}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const inferCategoryId = (major: Major, moduleCode: string): string => {
  const defaultEntry = major.defaultPlan.find((entry) => entry.moduleCode === moduleCode);
  if (defaultEntry) return defaultEntry.categoryId;

  const requirement = major.requirements.find((req) =>
    req.categoryId && req.fulfilledBy.some((fulfiller) => matchesFulfiller(moduleCode, fulfiller)),
  );
  return requirement?.categoryId ?? major.categories[0]?.id ?? '';
};

const matchesFulfiller = (moduleCode: string, fulfiller: string): boolean =>
  fulfiller.endsWith('*') ? moduleCode.startsWith(fulfiller.slice(0, -1)) : moduleCode === fulfiller;