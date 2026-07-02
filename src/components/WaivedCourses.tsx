import { useMemo, useState } from 'react';
import type { Major, WaivedModule } from '@shared/types';

interface Props {
  major: Major;
  waivedModules: WaivedModule[];
  onAdd: (module: WaivedModule) => void;
  onDelete: (code: string) => void;
}

export const WaivedCourses = ({ major, waivedModules, onAdd, onDelete }: Props) => {
  const [code, setCode] = useState('');
  const knownCodes = useMemo(() => Object.keys(major.moduleCatalog).sort(), [major.moduleCatalog]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const moduleCode = code.trim().toUpperCase();
    if (!moduleCode) return;

    const catalogModule = major.moduleCatalog[moduleCode];
    onAdd({
      code: moduleCode,
      name: catalogModule?.name ?? moduleCode,
      mcs: catalogModule?.mcs ?? 0,
      categoryId: inferCategoryId(major, moduleCode),
    });
    setCode('');
  };

  return (
    <section className="rounded-4xl bg-paper px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-ink">Waived</h2>
          <span className="text-xs text-muted">{waivedModules.length}</span>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full gap-2 sm:w-auto">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Course code"
            list="waived-course-codes"
            className="min-w-0 flex-1 rounded-2xl bg-canvas border border-ink/10 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 sm:w-44"
            autoComplete="off"
          />
          <datalist id="waived-course-codes">
            {knownCodes.map((moduleCode) => (
              <option key={moduleCode} value={moduleCode} />
            ))}
          </datalist>
          <button
            type="submit"
            className="rounded-2xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-40"
            disabled={!code.trim()}
          >
            Add
          </button>
        </form>
      </div>

      {waivedModules.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {waivedModules.map((module) => {
            const category = major.categories.find((cat) => cat.id === module.categoryId);
            return (
              <li
                key={module.code}
                className="flex items-center gap-2 rounded-2xl bg-canvas px-3 py-2"
              >
                <span className="font-mono text-xs font-bold text-ink">{module.code}</span>
                {category && <span className="text-xs text-muted">{category.label}</span>}
                <button
                  type="button"
                  onClick={() => onDelete(module.code)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs leading-none text-canvas hover:bg-ink/80"
                  aria-label={`Remove waived ${module.code}`}
                >
                  x
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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