import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DisciplineId, RiverData, RiverPebble } from './competencyTypes';
import {
  DISCIPLINES,
  DISCIPLINE_ORDER,
  getDisciplineInfo,
  getKnownPrerequisites,
  hexToRgba,
} from './competencyData';

interface Props {
  data: RiverData;
}

type RiverMode = 'workload' | 'cumulative';

type HoverState =
  | { kind: 'pebble'; pebble: RiverPebble }
  | { kind: 'stream'; discipline: DisciplineId; columnIndex: number };

interface RiverBand {
  discipline: DisciplineId;
  values: number[];
  lower: number[];
  upper: number[];
}

interface RiverLayout {
  x: number[];
  bands: RiverBand[];
  unit: number;
  centerY: number;
  axisMax: number;
  ticks: number[];
  step: number;
}

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 560;
const MARGIN = { top: 28, right: 34, bottom: 72, left: 62 };
const INNER_WIDTH = VIEW_WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = VIEW_HEIGHT - MARGIN.top - MARGIN.bottom;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const ribbonPath = (xs: number[], lower: number[], upper: number[]): string => {
  if (xs.length === 0) return '';
  if (xs.length === 1) {
    const half = 7;
    return `M ${xs[0] - half} ${lower[0]} L ${xs[0] + half} ${lower[0]} L ${xs[0] + half} ${upper[0]} L ${xs[0] - half} ${upper[0]} Z`;
  }
  let path = `M ${xs[0]} ${lower[0]}`;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const mid = (xs[index] + xs[index + 1]) / 2;
    path += ` C ${mid} ${lower[index]}, ${mid} ${lower[index + 1]}, ${xs[index + 1]} ${lower[index + 1]}`;
  }
  path += ` L ${xs[xs.length - 1]} ${upper[upper.length - 1]}`;
  for (let index = xs.length - 1; index > 0; index -= 1) {
    const mid = (xs[index] + xs[index - 1]) / 2;
    path += ` C ${mid} ${upper[index]}, ${mid} ${upper[index - 1]}, ${xs[index - 1]} ${upper[index - 1]}`;
  }
  return `${path} Z`;
};

const flowPath = (xs: number[], values: number[]): string => {
  if (xs.length === 0) return '';
  if (xs.length === 1) return `M ${xs[0] - 7} ${values[0]} L ${xs[0] + 7} ${values[0]}`;
  let path = `M ${xs[0]} ${values[0]}`;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const mid = (xs[index] + xs[index + 1]) / 2;
    path += ` C ${mid} ${values[index]}, ${mid} ${values[index + 1]}, ${xs[index + 1]} ${values[index + 1]}`;
  }
  return path;
};

export const RiverView = ({ data }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<RiverMode>('workload');
  const [hover, setHover] = useState<HoverState | null>(null);

  const positionTooltip = useCallback((clientX: number, clientY: number) => {
    const element = tooltipRef.current;
    const container = containerRef.current;
    if (!element || !container) return;
    const rect = container.getBoundingClientRect();
    const width = element.offsetWidth || 270;
    const height = element.offsetHeight || 140;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    let left = localX + 16;
    let top = localY + 16;
    if (left + width > rect.width - 10) left = localX - width - 16;
    if (top + height > rect.height - 10) top = localY - height - 16;
    element.style.transform = `translate(${Math.max(10, left)}px, ${Math.max(10, top)}px)`;
  }, []);

  useEffect(() => {
    if (hover) positionTooltip(pointerRef.current.x, pointerRef.current.y);
  }, [hover, positionTooltip]);

  const layout = useMemo<RiverLayout>(() => {
    const columns = data.columns;
    const count = columns.length;
    const x =
      count === 0
        ? []
        : count === 1
          ? [MARGIN.left + INNER_WIDTH / 2]
          : columns.map((_, index) => MARGIN.left + (index * INNER_WIDTH) / (count - 1));

    const valuesByDiscipline = new Map<DisciplineId, number[]>();
    for (const discipline of DISCIPLINE_ORDER) {
      valuesByDiscipline.set(
        discipline,
        columns.map((column) =>
          mode === 'workload'
            ? column.byDiscipline[discipline]
            : column.cumulativeByDiscipline[discipline],
        ),
      );
    }

    const totals = columns.map((_, columnIndex) =>
      DISCIPLINE_ORDER.reduce(
        (sum, discipline) => sum + (valuesByDiscipline.get(discipline)?.[columnIndex] ?? 0),
        0,
      ),
    );
    const maxTotal = Math.max(0, ...totals);
    const axisStep = mode === 'workload' ? 5 : 20;
    const axisMax = Math.max(axisStep, Math.ceil(maxTotal / axisStep) * axisStep);
    const unit = (INNER_HEIGHT * 0.84) / axisMax;
    const centerY = MARGIN.top + INNER_HEIGHT * 0.47;
    const prior = columns.map(() => 0);
    const bands: RiverBand[] = [];

    for (const discipline of DISCIPLINE_ORDER) {
      const values = valuesByDiscipline.get(discipline) ?? [];
      const lower = columns.map(
        (_, columnIndex) => centerY - (totals[columnIndex] * unit) / 2 + prior[columnIndex] * unit,
      );
      const upper = lower.map((value, columnIndex) => value + values[columnIndex] * unit);
      bands.push({ discipline, values, lower, upper });
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        prior[columnIndex] += values[columnIndex];
      }
    }

    const step = count > 1 ? INNER_WIDTH / (count - 1) : INNER_WIDTH;
    const ticks = [0, axisMax / 2, axisMax];

    return { x, bands, unit, centerY, axisMax, ticks, step };
  }, [data.columns, mode]);

  const activeDiscipline = hover
    ? hover.kind === 'pebble'
      ? hover.pebble.discipline
      : hover.discipline
    : null;

  const hoveredStreamInfo = (() => {
    if (!hover || hover.kind !== 'stream') return null;
    const column = data.columns[hover.columnIndex];
    if (!column) return null;
    const info = getDisciplineInfo(hover.discipline);
    const pebbles = column.pebbles.filter((pebble) => pebble.discipline === hover.discipline);
    return {
      info,
      column,
      pebbles,
      semesterMcs: column.byDiscipline[hover.discipline],
      cumulativeMcs: column.cumulativeByDiscipline[hover.discipline],
    };
  })();

  const hoveredPebbleInfo = (() => {
    if (!hover || hover.kind !== 'pebble') return null;
    return {
      info: getDisciplineInfo(hover.pebble.discipline),
      pebble: hover.pebble,
      prerequisites: getKnownPrerequisites(hover.pebble.code),
    };
  })();

  const axisTop = layout.centerY - (layout.axisMax * layout.unit) / 2;
  const axisBottom = layout.centerY + (layout.axisMax * layout.unit) / 2;

  const handleMove = (event: React.MouseEvent<SVGElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    positionTooltip(event.clientX, event.clientY);
  };

  const enterStream = (discipline: DisciplineId, columnIndex: number, event: React.MouseEvent<SVGElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setHover({ kind: 'stream', discipline, columnIndex });
    positionTooltip(event.clientX, event.clientY);
  };

  const enterPebble = (pebble: RiverPebble, event: React.MouseEvent<SVGElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    setHover({ kind: 'pebble', pebble });
    positionTooltip(event.clientX, event.clientY);
  };

  return (
    <div ref={containerRef} className="relative flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <h3 className="text-sm font-semibold text-ink">River</h3>
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-ink/10 bg-[#f8f5ee]/80 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('workload')}
            aria-pressed={mode === 'workload'}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              mode === 'workload' ? 'bg-ink text-canvas shadow-xs' : 'text-muted hover:text-ink'
            }`}
          >
            Semester Load
          </button>
          <button
            type="button"
            onClick={() => setMode('cumulative')}
            aria-pressed={mode === 'cumulative'}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              mode === 'cumulative' ? 'bg-ink text-canvas shadow-xs' : 'text-muted hover:text-ink'
            }`}
          >
            Cumulative Mastery
          </button>
        </div>
      </div>

      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {DISCIPLINE_ORDER.map((discipline) => {
          const info = DISCIPLINES[discipline];
          const total = data.cumulativeTotals[discipline];
          return (
            <span
              key={discipline}
              className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/35 px-2 py-0.5 text-[10px] leading-none text-ink"
              title={info.description}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: info.color }} />
              <span className="font-medium">{info.shortLabel}</span>
              <span className="font-mono text-[9px] text-muted">{total}</span>
            </span>
          );
        })}
        {data.waivedMcs > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/20 px-2 py-0.5 text-[10px] leading-none text-muted">
            Waived <span className="font-mono text-[9px]">{data.waivedMcs} MC</span>
          </span>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-[#f7f3ea]/55">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`River across ${data.columns.length} semesters, carrying ${data.totalMcs} MCs across seven disciplines.`}
        >
          <defs>
            {DISCIPLINE_ORDER.map((discipline) => {
              const info = DISCIPLINES[discipline];
              return (
                <linearGradient key={discipline} id={`river-fill-${discipline}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={info.wash} stopOpacity="0.92" />
                  <stop offset="44%" stopColor={info.color} stopOpacity="0.42" />
                  <stop offset="72%" stopColor={info.wash} stopOpacity="0.78" />
                  <stop offset="100%" stopColor={info.color} stopOpacity="0.3" />
                </linearGradient>
              );
            })}
            <filter id="river-wash" x="-4%" y="-12%" width="108%" height="124%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.055" numOctaves="2" seed="7" result="grain" />
              <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>

          {/* Semester guides and scale */}
          {layout.x.map((x, index) => (
            <g key={`guide-${data.columns[index]?.key ?? index}`} pointerEvents="none">
              <line
                x1={x}
                x2={x}
                y1={MARGIN.top}
                y2={VIEW_HEIGHT - MARGIN.bottom + 4}
                stroke="#c7bfb0"
                strokeOpacity="0.48"
                strokeDasharray="3 6"
              />
              <text
                x={x}
                y={VIEW_HEIGHT - MARGIN.bottom + 26}
                textAnchor="middle"
                fontSize="10"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill="#5a5956"
              >
                {data.columns[index]?.label ?? ''}
              </text>
            </g>
          ))}

          <g pointerEvents="none">
            {layout.ticks.map((tick, index) => {
              const y = axisBottom - (tick / layout.axisMax) * (axisBottom - axisTop);
              return (
                <g key={`tick-${index}`}>
                  <line
                    x1={MARGIN.left - 5}
                    x2={MARGIN.left}
                    y1={y}
                    y2={y}
                    stroke="#c7bfb0"
                    strokeOpacity="0.7"
                  />
                  <text
                    x={MARGIN.left - 9}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill="#5a5956"
                  >
                    {Math.round(tick)}
                  </text>
                </g>
              );
            })}
            <text
              x={MARGIN.left - 9}
              y={MARGIN.top - 10}
              textAnchor="end"
              fontSize="8"
              letterSpacing="1.2"
              fill="#5a5956"
            >
              MC
            </text>
          </g>

          {/* Watercolour ribbons */}
          {layout.bands.map((band, bandIndex) => {
            const info = DISCIPLINES[band.discipline];
            const path = ribbonPath(layout.x, band.lower, band.upper);
            const dimmed = activeDiscipline !== null && activeDiscipline !== band.discipline;
            const highlighted = activeDiscipline === band.discipline;
            const midpoints = band.lower.map((value, index) => (value + band.upper[index]) / 2);
            return (
              <g key={`river-${band.discipline}`} pointerEvents="none">
                <path
                  d={path}
                  fill={`url(#river-fill-${band.discipline})`}
                  stroke={info.color}
                  strokeOpacity={dimmed ? 0.14 : highlighted ? 0.92 : 0.54}
                  strokeWidth={highlighted ? 1.8 : 1.1}
                  opacity={dimmed ? 0.27 : 1}
                  filter="url(#river-wash)"
                  style={{ transition: 'opacity 160ms ease, stroke-width 160ms ease' }}
                />
                {band.values.some((value) => value > 0) && (
                  <path
                    d={flowPath(layout.x, midpoints)}
                    fill="none"
                    stroke={info.color}
                    strokeOpacity={dimmed ? 0.12 : highlighted ? 0.7 : 0.28}
                    strokeWidth={highlighted ? 1.2 : 0.8}
                    strokeDasharray="1.5 11"
                    strokeLinecap="round"
                    opacity={dimmed ? 0.4 : 1}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      values="0;-38"
                      dur={`${5.6 + bandIndex * 0.35}s`}
                      repeatCount="indefinite"
                    />
                  </path>
                )}
              </g>
            );
          })}

          {/* Invisible per-column hit targets for stream summaries */}
          {layout.bands.map((band) =>
            band.values.map((value, columnIndex) => {
              if (value <= 0) return null;
              const lower = band.lower[columnIndex];
              const height = Math.max(8, value * layout.unit);
              return (
                <rect
                  key={`hit-${band.discipline}-${columnIndex}`}
                  x={layout.x[columnIndex] - layout.step / 2}
                  y={lower}
                  width={Math.max(22, layout.step)}
                  height={height}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(event) => enterStream(band.discipline, columnIndex, event)}
                  onMouseMove={handleMove}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>
                    {`${DISCIPLINES[band.discipline].label}: ${data.columns[columnIndex]?.byDiscipline[band.discipline] ?? 0} MCs in ${data.columns[columnIndex]?.label ?? ''}`}
                  </title>
                </rect>
              );
            }),
          )}

          {/* Module pebbles */}
          {layout.bands.map((band) =>
            data.columns.flatMap((column, columnIndex) =>
              column.pebbles
                .filter((pebble) => pebble.discipline === band.discipline)
                .map((pebble) => {
                  const info = DISCIPLINES[band.discipline];
                  const base =
                    mode === 'workload' ? pebble.semesterBefore : pebble.cumulativeBefore;
                  const lower = band.lower[columnIndex] ?? 0;
                  const height = clamp(pebble.mcs * layout.unit * 0.64, 9, 17);
                  const center = lower + (base + pebble.mcs / 2) * layout.unit;
                  const width = clamp(pebble.code.length * 5.1 + 11, 31, 58);
                  const y = clamp(
                    center - height / 2,
                    (band.lower[columnIndex] ?? center) - 1,
                    (band.upper[columnIndex] ?? center) - height + 1,
                  );
                  const dimmed = activeDiscipline !== null && activeDiscipline !== band.discipline;
                  return (
                    <g
                      key={`pebble-${pebble.code}-${column.key}`}
                      transform={`translate(${layout.x[columnIndex]}, 0)`}
                      opacity={dimmed ? 0.42 : 1}
                      style={{ cursor: 'pointer', transition: 'opacity 160ms ease' }}
                      onMouseEnter={(event) => enterPebble(pebble, event)}
                      onMouseMove={handleMove}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>{`${pebble.code} — ${pebble.name} (${pebble.mcs} MC, ${pebble.semesterLabel})`}</title>
                      <rect
                        x={-width / 2}
                        y={y}
                        width={width}
                        height={height}
                        rx={height / 2}
                        fill="#fbf8f1"
                        fillOpacity="0.94"
                        stroke={info.color}
                        strokeOpacity="0.78"
                        strokeWidth="1"
                      />
                      <text
                        x={0}
                        y={y + height / 2 + 0.4}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={clamp(height * 0.62, 5.8, 8)}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontWeight="600"
                        fill="#141413"
                      >
                        {pebble.code}
                      </text>
                    </g>
                  );
                }),
            ),
          )}

          {/* Footer note */}
          <text
            x={VIEW_WIDTH - MARGIN.right}
            y={VIEW_HEIGHT - 12}
            textAnchor="end"
            fontSize="8"
            letterSpacing="1.1"
            fill="#5a5956"
          >
            {mode === 'workload' ? 'CURRENT SEMESTER LOAD' : 'ACCUMULATED KNOWLEDGE'}
          </text>
        </svg>

        {hover && (
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none absolute left-0 top-0 z-30 w-[272px] rounded-2xl border border-ink/15 bg-[#fbf8f1]/96 p-3 text-ink shadow-soft backdrop-blur-sm"
          >
            {hoveredPebbleInfo && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold leading-tight">
                      {hoveredPebbleInfo.pebble.code}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted">
                      {hoveredPebbleInfo.pebble.name}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: hexToRgba(hoveredPebbleInfo.info.color, 0.12),
                      color: hoveredPebbleInfo.info.color,
                    }}
                  >
                    {hoveredPebbleInfo.info.shortLabel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-ink/10 pt-2 text-[10px]">
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-muted">Credits</div>
                    <div className="font-medium">{hoveredPebbleInfo.pebble.mcs} MC</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-muted">Semester</div>
                    <div className="font-medium">{hoveredPebbleInfo.pebble.semesterLabel}</div>
                  </div>
                </div>
                <div className="mt-2 border-t border-ink/10 pt-2 text-[10px]">
                  <div className="text-[9px] uppercase tracking-wide text-muted">Prerequisites</div>
                  <div className="mt-0.5 font-medium">
                    {hoveredPebbleInfo.prerequisites.length > 0
                      ? hoveredPebbleInfo.prerequisites.join(', ')
                      : 'None recorded'}
                  </div>
                </div>
              </>
            )}

            {hoveredStreamInfo && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold leading-tight">
                      {hoveredStreamInfo.info.label}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      {hoveredStreamInfo.column.label}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: hexToRgba(hoveredStreamInfo.info.color, 0.12),
                      color: hoveredStreamInfo.info.color,
                    }}
                  >
                    {mode === 'workload'
                      ? `${hoveredStreamInfo.semesterMcs} MC`
                      : `${hoveredStreamInfo.cumulativeMcs} MC`}
                  </span>
                </div>
                <p className="mt-2 border-t border-ink/10 pt-2 text-[10px] leading-relaxed text-ink">
                  {mode === 'workload'
                    ? `${hoveredStreamInfo.semesterMcs} MCs in ${hoveredStreamInfo.column.label}`
                    : `${hoveredStreamInfo.cumulativeMcs} MCs accumulated by ${hoveredStreamInfo.column.label}`}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  {hoveredStreamInfo.pebbles.length > 0
                    ? hoveredStreamInfo.pebbles.map((pebble) => pebble.code).join(', ')
                    : 'No modules in this discipline this term'}
                </p>
                {mode === 'cumulative' && (
                  <p className="mt-1 text-[9px] text-muted">
                    This term: {hoveredStreamInfo.semesterMcs} MC
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
