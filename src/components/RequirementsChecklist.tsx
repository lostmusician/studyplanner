interface Requirement {
  name: string;
  fulfilled: boolean;
}

interface Props {
  requirements: Requirement[];
}

export const RequirementsChecklist = ({ requirements }: Props) => {
  const fulfilled = requirements.filter((r) => r.fulfilled).length;

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

      <ul className="flex flex-col gap-2">
        {requirements.map((req) => (
          <li key={req.name} className="flex items-start gap-2.5">
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
        ))}
      </ul>
    </div>
  );
};
