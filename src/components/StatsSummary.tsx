import type { Major } from '@shared/types';
import type { Stats } from '../lib/studyPlan';

interface Props {
  major: Major;
  stats: Stats;
}

export const StatsSummary = ({ major, stats }: Props) => {
  return (
    <div className="flex flex-wrap gap-3">
      <StatCard
        label="Total MCs"
        value={stats.totalMc}
        target={major.totalMcTarget}
        color="#d4c9b8"
      />
      {major.categories.map((cat) => (
        <StatCard
          key={cat.id}
          label={cat.label}
          value={stats.byCategory[cat.id] ?? 0}
          target={cat.mcTarget}
          color={cat.color}
        />
      ))}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target?: number;
  color: string;
}) => {
  const pct = target ? Math.min(100, (value / target) * 100) : null;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-3xl px-5 py-4 min-w-[140px]"
      style={{ backgroundColor: color }}
    >
      <span className="text-xs text-ink/60 font-medium tracking-wide uppercase">{label}</span>
      <span className="text-2xl font-bold text-ink leading-none">
        {value}
        {target && <span className="text-sm font-normal text-ink/50 ml-1">/ {target}</span>}
      </span>
      {pct !== null && (
        <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-ink/30 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};
