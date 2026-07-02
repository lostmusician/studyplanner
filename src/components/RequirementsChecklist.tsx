import type { MajorCategory } from '@shared/types';

interface Requirement {
  name: string;
  fulfilled: boolean;
  categoryId?: string;
}

interface Props {
  requirements: Requirement[];
  categories: MajorCategory[];
}

interface Group {
  id: string;
  label: string;
  items: Requirement[];
}

export const RequirementsChecklist = ({ requirements, categories }: Props) => {
  const fulfilled = requirements.filter((r) => r.fulfilled).length;

  const groups: Group[] = categories
    .map((cat) => ({
      id: cat.id,
      label: cat.label,
      items: requirements.filter((r) => r.categoryId === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const knownIds = new Set(categories.map((c) => c.id));
  const uncategorized = requirements.filter((r) => !r.categoryId || !knownIds.has(r.categoryId));
  if (uncategorized.length > 0) {
    groups.push({ id: 'uncategorized', label: 'Other', items: uncategorized });
  }

  return (
    <div className="rounded-4xl bg-paper p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink text-sm">Requirements</h2>
        <span className="text-xs text-muted">
          {fulfilled}/{requirements.length}
        </span>
      </div>

      {requirements.length === 0 && (
        <p className="text-xs text-muted">No requirements defined for this major.</p>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted">{group.label}</p>
              <span className="text-[10px] text-muted">
                {group.items.filter((r) => r.fulfilled).length}/{group.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {group.items.map((req) => (
                <RequirementRow key={req.name} req={req} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const RequirementRow = ({ req }: { req: Requirement }) => (
  <li className="flex items-start gap-2.5">
    <span
      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
      style={{
        backgroundColor: req.fulfilled ? 'rgb(20,20,19)' : 'transparent',
        border: req.fulfilled ? 'none' : '1.5px solid rgb(108,107,104)',
      }}
    >
      {req.fulfilled && (
        <svg
          viewBox="0 0 10 8"
          fill="none"
          stroke="rgb(239,238,231)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-2.5 h-2"
        >
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
    </span>
    <span
      className="text-xs leading-relaxed"
      style={{ color: req.fulfilled ? 'rgb(20,20,19)' : 'rgb(108,107,104)' }}
    >
      {req.name}
    </span>
  </li>
);
