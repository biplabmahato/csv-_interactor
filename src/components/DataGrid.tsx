import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { compareCellValues } from '../shared/csvEngine.ts';
import type { ColumnProfile, ColumnType } from '../shared/types.ts';

interface DataGridProps {
  headers: string[];
  rows: Record<string, string>[];
  columns: ColumnProfile[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSortChange: (column: string) => void;
}

const PAGE_SIZE = 50;

function typeShortLabel(t: ColumnType): string {
  switch (t) {
    case 'currency':
      return '$';
    case 'percent':
      return '%';
    case 'number':
      return '#';
    case 'date':
      return 'date';
    case 'boolean':
      return 'bool';
    default:
      return 'text';
  }
}

function isNumericType(t: ColumnType): boolean {
  return t === 'number' || t === 'currency' || t === 'percent';
}

export function DataGrid({
  headers,
  rows,
  columns,
  searchQuery,
  onSearchChange,
  sortColumn,
  sortDirection,
  onSortChange,
}: DataGridProps) {
  const [page, setPage] = useState(1);

  const colTypeMap = useMemo(() => {
    const map = new Map<string, ColumnType>();
    for (const c of columns) map.set(c.name, c.type);
    return map;
  }, [columns]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = q
      ? rows.filter((r) =>
          headers.some((h) => (r[h] ?? '').toLowerCase().includes(q))
        )
      : rows;

    if (!sortColumn) return base;
    const dir = sortDirection === 'desc' ? -1 : 1;
    return [...base].sort(
      (a, b) => compareCellValues(a[sortColumn] ?? '', b[sortColumn] ?? '') * dir
    );
  }, [rows, headers, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredAndSorted.slice(startIndex, startIndex + PAGE_SIZE);

  const handleSearch = (val: string) => {
    onSearchChange(val);
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-slate-900">
      {/* Grid Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Filter rows..."
            aria-label="Filter rows"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-900"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums dark:text-slate-400">
          <span className="whitespace-nowrap">
            {filteredAndSorted.length === 0
              ? '0 matching rows'
              : `${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filteredAndSorted.length)} of ${filteredAndSorted.length.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* High-Density Table Viewport */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950">
            <tr>
              <th className="w-12 border-r border-b border-slate-200 px-3 py-2 text-right font-mono text-[11px] font-medium text-slate-400 dark:border-slate-800 dark:text-slate-500">
                #
              </th>
              {headers.map((header) => {
                const colType = colTypeMap.get(header) ?? 'string';
                const numeric = isNumericType(colType);
                const isSorted = sortColumn === header;
                return (
                  <th
                    key={header}
                    className="border-r border-b border-slate-200 p-0 whitespace-nowrap last:border-r-0 dark:border-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(header)}
                      className={`flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70 ${
                        numeric ? 'justify-end' : 'justify-between'
                      } ${isSorted ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <span className="truncate max-w-[180px]" title={header}>
                        {header}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        <span>{typeShortLabel(colType)}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No rows match &ldquo;{searchQuery}&rdquo;.
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIdx) => (
                <tr
                  key={startIndex + rowIdx}
                  className="h-9 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="border-r border-slate-100 px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-400 dark:border-slate-800/80 dark:text-slate-500">
                    {startIndex + rowIdx + 1}
                  </td>
                  {headers.map((header) => {
                    const colType = colTypeMap.get(header) ?? 'string';
                    const numeric = isNumericType(colType);
                    const val = row[header] ?? '';
                    return (
                      <td
                        key={header}
                        title={val}
                        className={`max-w-[240px] truncate border-r border-slate-100 px-3 py-1.5 last:border-r-0 dark:border-slate-800/80 ${
                          numeric
                            ? 'text-right font-mono text-[12px] tabular-nums text-slate-800 dark:text-slate-200'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {val || (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
