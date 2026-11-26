import { useState } from 'react';
import type { ChartSpec } from '../shared/types.ts';

interface DataChartProps {
  chart: ChartSpec;
}

const SERIES_COLORS = [
  '#2563EB', // Cobalt primary
  '#0D9488', // Teal
  '#D97706', // Amber
  '#4F46E5', // Indigo
  '#64748B', // Slate
  '#16A34A', // Emerald
];

function formatNumber(val: number, prefix?: string, suffix?: string): string {
  const abs = Math.abs(val);
  let numStr: string;
  if (abs >= 1_000_000) {
    numStr = `${(val / 1_000_000).toFixed(2)}M`;
  } else if (abs >= 10_000) {
    numStr = val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  } else if (Number.isInteger(val)) {
    numStr = val.toLocaleString();
  } else {
    numStr = val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return `${prefix ?? ''}${numStr}${suffix ?? ''}`;
}

function formatAxisNumber(val: number, prefix?: string, suffix?: string): string {
  const abs = Math.abs(val);
  let str: string;
  if (abs >= 1_000_000) {
    str = `${(val / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    str = `${(val / 1_000).toFixed(1)}k`;
  } else {
    str = Number.isInteger(val) ? String(val) : val.toFixed(1);
  }
  return `${prefix ?? ''}${str}${suffix ?? ''}`;
}

export function DataChart({ chart }: DataChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const data = chart.data.slice(0, 24);
  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);

  if (chart.chartType === 'donut') {
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 68;
    const innerRadius = 42;
    let cumulativeAngle = -Math.PI / 2;

    const slices = data.map((d, idx) => {
      const val = Math.max(0, d.value);
      const fraction = total > 0 ? val / total : 0;
      const angle = fraction * Math.PI * 2;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const ix1 = cx + innerRadius * Math.cos(endAngle);
      const iy1 = cy + innerRadius * Math.sin(endAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      const pathData =
        fraction >= 0.9999
          ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} L ${cx - 0.01} ${cy - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius} Z`
          : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      return {
        ...d,
        idx,
        fraction,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        pathData,
      };
    });

    const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h4>
          {chart.subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{chart.subtitle}</p>
          )}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex shrink-0 items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
              {slices.map((s) => (
                <path
                  key={s.label}
                  d={s.pathData}
                  fill={s.color}
                  opacity={hoveredIdx === null || hoveredIdx === s.idx ? 1 : 0.35}
                  className="cursor-pointer transition-opacity duration-150"
                  onMouseEnter={() => setHoveredIdx(s.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="max-w-[74px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {activeSlice ? activeSlice.label : 'Total'}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {activeSlice
                  ? formatNumber(activeSlice.value, chart.valuePrefix, chart.valueSuffix)
                  : formatNumber(total, chart.valuePrefix, chart.valueSuffix)}
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {slices.map((s) => (
              <div
                key={s.label}
                onMouseEnter={() => setHoveredIdx(s.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1 text-xs transition-colors ${
                  hoveredIdx === s.idx
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate text-slate-700 dark:text-slate-300" title={s.label}>
                    {s.label}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  <span>{formatNumber(s.value, chart.valuePrefix, chart.valueSuffix)}</span>
                  <span className="w-11 text-right text-slate-400 dark:text-slate-500">
                    {(s.fraction * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bar & Line Chart
  const width = 520;
  const height = 220;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 46;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const rawMin = Math.min(...data.map((d) => d.value), 0);
  const yMax = rawMax === rawMin ? rawMax + 1 : rawMax * 1.08;
  const yMin = rawMin < 0 ? rawMin * 1.08 : 0;
  const yRange = yMax - yMin || 1;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = yMin + yRange * t;
    const y = padTop + plotH - t * plotH;
    return { val, y };
  });

  const zeroY = padTop + plotH - ((0 - yMin) / yRange) * plotH;
  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{chart.title}</h4>
          {chart.subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{chart.subtitle}</p>
          )}
        </div>
        {activeItem && (
          <div className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-right dark:border-slate-700 dark:bg-slate-800">
            <div className="max-w-[140px] truncate text-[11px] text-slate-500 dark:text-slate-400">
              {activeItem.label}
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(activeItem.value, chart.valuePrefix, chart.valueSuffix)}
            </div>
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[360px] select-none"
          role="img"
          aria-label={chart.title}
        >
          {/* Horizontal gridlines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[10px] tabular-nums dark:fill-slate-500"
              >
                {formatAxisNumber(tick.val, chart.valuePrefix, chart.valueSuffix)}
              </text>
            </g>
          ))}

          {chart.chartType === 'bar' ? (
            data.map((d, i) => {
              const slotW = plotW / data.length;
              const barW = Math.min(36, Math.max(8, slotW * 0.62));
              const x = padLeft + i * slotW + (slotW - barW) / 2;
              const valY = padTop + plotH - ((d.value - yMin) / yRange) * plotH;
              const topY = Math.min(valY, zeroY);
              const barH = Math.max(2, Math.abs(zeroY - valY));
              const showLabel =
                data.length <= 10 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1;

              return (
                <g
                  key={`${d.label}-${i}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <rect
                    x={padLeft + i * slotW}
                    y={padTop}
                    width={slotW}
                    height={plotH}
                    fill="transparent"
                  />
                  <rect
                    x={x}
                    y={topY}
                    width={barW}
                    height={barH}
                    rx={2}
                    fill={hoveredIdx === i ? '#1D4ED8' : '#2563EB'}
                    opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.45}
                    className="transition-opacity duration-150"
                  />
                  {showLabel && (
                    <text
                      x={x + barW / 2}
                      y={height - 16}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] dark:fill-slate-400"
                    >
                      {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
                    </text>
                  )}
                </g>
              );
            })
          ) : (
            (() => {
              const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
              const points = data.map((d, i) => {
                const x = data.length === 1 ? padLeft + plotW / 2 : padLeft + i * stepX;
                const y = padTop + plotH - ((d.value - yMin) / yRange) * plotH;
                return { x, y, d, i };
              });
              const linePath = points
                .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                .join(' ');
              const areaPath =
                points.length > 1
                  ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`
                  : '';

              return (
                <>
                  {areaPath && (
                    <path d={areaPath} fill="#2563EB" opacity={0.08} />
                  )}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {points.map((p) => {
                    const showLabel =
                      data.length <= 8 ||
                      p.i % Math.ceil(data.length / 7) === 0 ||
                      p.i === data.length - 1;
                    return (
                      <g
                        key={`${p.d.label}-${p.i}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(p.i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredIdx === p.i ? 5 : 3}
                          fill={hoveredIdx === p.i ? '#1D4ED8' : '#2563EB'}
                          stroke="#FFFFFF"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={p.x - Math.max(10, stepX / 2)}
                          y={padTop}
                          width={Math.max(20, stepX)}
                          height={plotH}
                          fill="transparent"
                        />
                        {showLabel && (
                          <text
                            x={p.x}
                            y={height - 16}
                            textAnchor="middle"
                            className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                          >
                            {p.d.label.length > 10 ? `${p.d.label.slice(0, 9)}…` : p.d.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            })()
          )}
        </svg>
      </div>
    </div>
  );
}
