import { useState, useRef, useEffect } from 'react';
import { searchNusModsModules, fetchNusModsModuleDetail } from '@shared/nusmods';
import type { NusModsModuleSummary } from '@shared/nusmods';
import type { Module } from '@shared/types';

interface Props {
  onSelect: (module: Module) => void;
  placeholder?: string;
}

export const ModuleSearch = ({ onSelect, placeholder = 'Search by code or title…' }: Props) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NusModsModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { items } = await searchNusModsModules(value, 10);
        setSuggestions(items);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = async (item: NusModsModuleSummary) => {
    setOpen(false);
    setQuery('');
    setLoading(true);
    try {
      const { detail } = await fetchNusModsModuleDetail(item.moduleCode, item.acadYear);
      onSelect({
        code: item.moduleCode,
        name: item.title,
        mcs: parseInt(detail.moduleCredit ?? '4', 10) || 4,
      });
    } catch {
      onSelect({ code: item.moduleCode, name: item.title, mcs: 4 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">…</span>
      )}
      {open && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-ink rounded-xl overflow-hidden shadow-soft max-h-56 overflow-y-auto">
          {suggestions.map((item) => (
            <li key={item.moduleCode}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 hover:bg-canvas/10 transition-colors"
                onClick={() => handleSelect(item)}
              >
                <span className="text-xs font-mono font-bold text-canvas">{item.moduleCode}</span>
                <span className="text-xs text-canvas/60 ml-2 truncate">{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
