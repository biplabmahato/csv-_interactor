import type { DatasetSummary } from '../shared/types.ts';

interface ColumnProfileViewProps {
  summary: DatasetSummary;
  onAskAboutColumn: (question: string) => void;
}

function fmtStat(val: number | undefined): string {
  if (val === undefined) return '—';
  if (Math.abs(val) >= 1000) {
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

export function ColumnProfileView({ summary, onAskAboutColumn }: ColumnProfileViewProps) {
  const totalCells = summary.rowCount * summary.columnCount;
  const totalNonNull = summary.columns.reduce((acc, c) => acc + c.nonNullCount, 0);
  const completeness = totalCells > 0 ? ((totalNonNull / totalCells) * 100).toFixed(1) : '100.0';
  const numericCount = summary.columns.filter(
    (c) => c.type === 'number' || c.type === 'currency' || c.type === 'percent'
  ).length;

  return (
    <div className="h-full overflow-y-auto bg-white p-6 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Summary Strip */}
        <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/70 sm:grid-cols-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total rows</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {summary.rowCount.toLocaleString()}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Columns</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {summary.columnCount}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Numeric metrics</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {numericCount}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Cell completeness</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {completeness}%
            </div>
          </div>
        </div>

        {/* Column Table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
                  Column
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
                  Type
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-800">
                  Unique
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-800">
                  Missing
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-800">
                  Min / Median / Max
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-semibold dark:border-slate-800">
                  Top values
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold dark:border-slate-800">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {summary.columns.map((col) => {
                const missingPct =
                  summary.rowCount > 0
                    ? ((col.nullCount / summary.rowCount) * 100).toFixed(1)
                    : '0.0';
                const hasNumericStats = col.min !== undefined && col.max !== undefined;

                return (
                  <tr
                    key={col.name}
                    className="align-top transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {col.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {col.type}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {col.uniqueCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {col.nullCount > 0 ? `${col.nullCount} (${missingPct}%)` : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {hasNumericStats ? (
                        <div className="space-y-0.5">
                          <div>
                            {fmtStat(col.min)} / {fmtStat(col.median)} / {fmtStat(col.max)}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            mean {fmtStat(col.mean)} · sum {fmtStat(col.sum)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[240px] space-y-1">
                        {col.topValues.slice(0, 3).map((tv) => {
                          const pct =
                            col.nonNullCount > 0
                              ? Math.round((tv.count / col.nonNullCount) * 100)
                              : 0;
                          return (
                            <div key={tv.value} className="space-y-0.5">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span
                                  className="truncate text-slate-700 dark:text-slate-300"
                                  title={tv.value}
                                >
                                  {tv.value}
                                </span>
                                <span className="shrink-0 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                  {tv.count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-xs bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full bg-blue-600/80 dark:bg-blue-500/80"
                                  style={{ width: `${Math.max(4, pct)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onAskAboutColumn(
                            `Analyze the distribution and notable outliers for the "${col.name}" column.`
                          )
                        }
                        className="whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
                      >
                        Analyze column
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
