import type {
  ColumnProfile,
  ColumnType,
  DatasetSummary,
  FilterCondition,
} from './types.ts';

export function parseNumericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Handle accounting negatives like ($1,234.50)
  const isParenNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  let cleaned = isParenNegative ? trimmed.slice(1, -1) : trimmed;
  cleaned = cleaned.replace(/[$€£¥,\s%]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*(\.\d+)?$/.test(cleaned)) return null;

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return isParenNegative ? -Math.abs(num) : num;
}

function isLikelyDate(raw: string): boolean {
  const s = raw.trim();
  if (!s || /^\d+(\.\d+)?$/.test(s)) return false;
  // Require date-like separators or month names
  if (!/[-/]/.test(s) && !/[a-zA-Z]{3}/.test(s)) return false;
  if (s.length < 6 || s.length > 32) return false;
  const parsed = Date.parse(s);
  return !Number.isNaN(parsed);
}

function isBooleanString(raw: string): boolean {
  const low = raw.trim().toLowerCase();
  return ['true', 'false', 'yes', 'no'].includes(low);
}

export function inferColumnType(values: string[]): ColumnType {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return 'string';

  const sample = nonEmpty.slice(0, 300);
  const threshold = Math.max(1, Math.floor(sample.length * 0.85));

  let currencyCount = 0;
  let percentCount = 0;
  let numberCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const val of sample) {
    if (isBooleanString(val)) {
      boolCount++;
      continue;
    }
    if (/^[\s(]*[$€£¥]/.test(val) && parseNumericValue(val) !== null) {
      currencyCount++;
      numberCount++;
      continue;
    }
    if (val.endsWith('%') && parseNumericValue(val) !== null) {
      percentCount++;
      numberCount++;
      continue;
    }
    if (parseNumericValue(val) !== null) {
      numberCount++;
      continue;
    }
    if (isLikelyDate(val)) {
      dateCount++;
    }
  }

  if (currencyCount >= threshold) return 'currency';
  if (percentCount >= threshold) return 'percent';
  if (numberCount >= threshold) return 'number';
  if (boolCount >= threshold) return 'boolean';
  if (dateCount >= threshold) return 'date';
  return 'string';
}

export function profileDataset(
  name: string,
  rows: Record<string, string>[],
  headers: string[],
  fileSizeBytes: number
): DatasetSummary {
  const columns: ColumnProfile[] = headers.map((colName) => {
    const rawValues = rows.map((r) => (r[colName] ?? '').toString());
    const type = inferColumnType(rawValues);

    let nonNullCount = 0;
    let nullCount = 0;
    const freqMap = new Map<string, number>();
    const numericVals: number[] = [];

    for (const raw of rawValues) {
      const trimmed = raw.trim();
      if (!trimmed) {
        nullCount++;
        continue;
      }
      nonNullCount++;
      freqMap.set(trimmed, (freqMap.get(trimmed) ?? 0) + 1);
      if (type === 'number' || type === 'currency' || type === 'percent') {
        const num = parseNumericValue(trimmed);
        if (num !== null) numericVals.push(num);
      }
    }

    const topValues = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([value, count]) => ({ value, count }));

    const profile: ColumnProfile = {
      name: colName,
      type,
      nonNullCount,
      nullCount,
      uniqueCount: freqMap.size,
      topValues,
      sampleValues: Array.from(freqMap.keys()).slice(0, 5),
    };

    if (numericVals.length > 0) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      const sum = numericVals.reduce((acc, v) => acc + v, 0);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      profile.min = sorted[0];
      profile.max = sorted[sorted.length - 1];
      profile.sum = Number(sum.toFixed(4));
      profile.mean = Number((sum / numericVals.length).toFixed(4));
      profile.median = Number(median.toFixed(4));
    }

    return profile;
  });

  return {
    name,
    rowCount: rows.length,
    columnCount: headers.length,
    fileSizeBytes,
    columns,
    sampleRows: rows.slice(0, 8),
  };
}

function matchesCondition(
  row: Record<string, string>,
  cond: FilterCondition
): boolean {
  const raw = (row[cond.column] ?? '').toString().trim();
  const op = cond.operator;

  if (op === 'is_empty') return raw.length === 0;
  if (op === 'not_empty') return raw.length > 0;

  const targetStr = cond.value !== undefined ? String(cond.value).trim() : '';
  const rawNum = parseNumericValue(raw);
  const targetNum = parseNumericValue(targetStr);

  if (op === 'eq') {
    if (rawNum !== null && targetNum !== null) return rawNum === targetNum;
    return raw.toLowerCase() === targetStr.toLowerCase();
  }
  if (op === 'neq') {
    if (rawNum !== null && targetNum !== null) return rawNum !== targetNum;
    return raw.toLowerCase() !== targetStr.toLowerCase();
  }
  if (op === 'contains') {
    return raw.toLowerCase().includes(targetStr.toLowerCase());
  }
  if (op === 'not_contains') {
    return !raw.toLowerCase().includes(targetStr.toLowerCase());
  }

  // Numeric or Date comparisons
  if (rawNum !== null && targetNum !== null) {
    if (op === 'gt') return rawNum > targetNum;
    if (op === 'gte') return rawNum >= targetNum;
    if (op === 'lt') return rawNum < targetNum;
    if (op === 'lte') return rawNum <= targetNum;
  }

  const rawDate = Date.parse(raw);
  const targetDate = Date.parse(targetStr);
  if (!Number.isNaN(rawDate) && !Number.isNaN(targetDate)) {
    if (op === 'gt') return rawDate > targetDate;
    if (op === 'gte') return rawDate >= targetDate;
    if (op === 'lt') return rawDate < targetDate;
    if (op === 'lte') return rawDate <= targetDate;
  }

  // Fallback lexicographical
  if (op === 'gt') return raw > targetStr;
  if (op === 'gte') return raw >= targetStr;
  if (op === 'lt') return raw < targetStr;
  if (op === 'lte') return raw <= targetStr;

  return false;
}

export function applyFilters(
  rows: Record<string, string>[],
  filters?: FilterCondition[]
): Record<string, string>[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matchesCondition(row, f)));
}

export function compareCellValues(aRaw: string, bRaw: string): number {
  const aTrim = aRaw.trim();
  const bTrim = bRaw.trim();
  if (!aTrim && !bTrim) return 0;
  if (!aTrim) return 1;
  if (!bTrim) return -1;

  const aNum = parseNumericValue(aTrim);
  const bNum = parseNumericValue(bTrim);
  if (aNum !== null && bNum !== null) {
    return aNum - bNum;
  }

  if (isLikelyDate(aTrim) && isLikelyDate(bTrim)) {
    return Date.parse(aTrim) - Date.parse(bTrim);
  }

  return aTrim.localeCompare(bTrim, undefined, { numeric: true, sensitivity: 'base' });
}

export function executeQueryRows(
  rows: Record<string, string>[],
  headers: string[],
  options: {
    filters?: FilterCondition[];
    selectColumns?: string[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    limit?: number;
  }
) {
  const filtered = applyFilters(rows, options.filters);
  const sorted = [...filtered];

  if (options.sortBy && headers.includes(options.sortBy)) {
    const col = options.sortBy;
    const dir = options.sortDir === 'desc' ? -1 : 1;
    sorted.sort((a, b) => compareCellValues(a[col] ?? '', b[col] ?? '') * dir);
  }

  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const cols =
    options.selectColumns && options.selectColumns.length > 0
      ? options.selectColumns.filter((c) => headers.includes(c))
      : headers;

  const resultRows = sorted.slice(0, limit).map((row) => {
    const picked: Record<string, string> = {};
    for (const c of cols) picked[c] = row[c] ?? '';
    return picked;
  });

  return {
    totalMatchingRows: filtered.length,
    returnedRows: resultRows.length,
    columns: cols,
    rows: resultRows,
  };
}

export interface AggregationMetric {
  column?: string;
  op: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median';
  alias?: string;
}

function getBucketedDateKey(raw: string, bucket?: 'month' | 'year' | 'day'): string {
  const trimmed = raw.trim();
  if (!trimmed) return '(Empty)';
  if (!bucket) return trimmed;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) return trimmed;
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  if (bucket === 'year') return `${yyyy}`;
  if (bucket === 'month') return `${yyyy}-${mm}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function executeAggregateData(
  rows: Record<string, string>[],
  headers: string[],
  options: {
    filters?: FilterCondition[];
    groupBy?: string[];
    dateBucket?: 'month' | 'year' | 'day';
    metrics: AggregationMetric[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    limit?: number;
  }
) {
  const filtered = applyFilters(rows, options.filters);
  const groupCols = (options.groupBy ?? []).filter((c) => headers.includes(c));
  const groups = new Map<string, { keys: Record<string, string>; rows: Record<string, string>[] }>();

  for (const row of filtered) {
    const keys: Record<string, string> = {};
    const parts: string[] = [];
    for (const col of groupCols) {
      let val = (row[col] ?? '').toString().trim() || '(Empty)';
      if (options.dateBucket && isLikelyDate(val)) {
        val = getBucketedDateKey(val, options.dateBucket);
      }
      keys[col] = val;
      parts.push(val);
    }
    const mapKey = parts.length > 0 ? parts.join('|||') : '__ALL__';
    let entry = groups.get(mapKey);
    if (!entry) {
      entry = { keys, rows: [] };
      groups.set(mapKey, entry);
    }
    entry.rows.push(row);
  }

  if (groups.size === 0 && groupCols.length === 0) {
    groups.set('__ALL__', { keys: {}, rows: [] });
  }

  const records: Record<string, string | number | null>[] = [];
  for (const group of groups.values()) {
    const out: Record<string, string | number | null> = { ...group.keys };

    for (const metric of options.metrics) {
      const colName = metric.column;
      const alias =
        metric.alias ??
        (metric.op === 'count' ? 'count' : `${metric.op}_${colName ?? 'rows'}`);

      if (metric.op === 'count') {
        if (!colName) {
          out[alias] = group.rows.length;
        } else {
          out[alias] = group.rows.filter((r) => (r[colName] ?? '').trim().length > 0).length;
        }
        continue;
      }

      if (!colName || !headers.includes(colName)) {
        out[alias] = null;
        continue;
      }

      const nums: number[] = [];
      for (const r of group.rows) {
        const n = parseNumericValue(r[colName]);
        if (n !== null) nums.push(n);
      }

      if (nums.length === 0) {
        out[alias] = null;
        continue;
      }

      if (metric.op === 'sum') {
        out[alias] = Number(nums.reduce((a, b) => a + b, 0).toFixed(4));
      } else if (metric.op === 'avg') {
        out[alias] = Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(4));
      } else if (metric.op === 'min') {
        out[alias] = Math.min(...nums);
      } else if (metric.op === 'max') {
        out[alias] = Math.max(...nums);
      } else if (metric.op === 'median') {
        const s = [...nums].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        const med = s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
        out[alias] = Number(med.toFixed(4));
      }
    }

    records.push(out);
  }

  if (options.sortBy) {
    const sKey = options.sortBy;
    const dir = options.sortDir === 'asc' ? 1 : -1;
    records.sort((a, b) => {
      const av = a[sKey];
      const bv = b[sKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return compareCellValues(String(av ?? ''), String(bv ?? '')) * dir;
    });
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  return {
    totalFilteredRows: filtered.length,
    totalGroups: records.length,
    results: records.slice(0, limit),
  };
}

export function executeColumnStatistics(
  rows: Record<string, string>[],
  column: string,
  filters?: FilterCondition[]
) {
  const filtered = applyFilters(rows, filters);
  const rawVals = filtered.map((r) => (r[column] ?? '').toString().trim());
  const nonEmpty = rawVals.filter((v) => v.length > 0);
  const type = inferColumnType(rawVals);

  const freq = new Map<string, number>();
  for (const v of nonEmpty) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }

  const topCategories = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([value, count]) => ({
      value,
      count,
      sharePercent: nonEmpty.length > 0 ? Number(((count / nonEmpty.length) * 100).toFixed(2)) : 0,
    }));

  if (type === 'number' || type === 'currency' || type === 'percent') {
    const nums = nonEmpty
      .map((v) => parseNumericValue(v))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    if (nums.length === 0) {
      return { column, type, totalRows: filtered.length, nonEmptyCount: nonEmpty.length, topCategories };
    }

    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nums.length;
    const stdDev = Math.sqrt(variance);
    const percentile = (p: number) => {
      const idx = Math.min(nums.length - 1, Math.max(0, Math.floor((nums.length - 1) * p)));
      return Number(nums[idx].toFixed(4));
    };

    return {
      column,
      type,
      totalRows: filtered.length,
      nonEmptyCount: nonEmpty.length,
      nullCount: filtered.length - nonEmpty.length,
      uniqueCount: freq.size,
      sum: Number(sum.toFixed(4)),
      mean: Number(mean.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      min: nums[0],
      p25: percentile(0.25),
      median: percentile(0.5),
      p75: percentile(0.75),
      p90: percentile(0.9),
      max: nums[nums.length - 1],
      topCategories: topCategories.slice(0, 8),
    };
  }

  return {
    column,
    type,
    totalRows: filtered.length,
    nonEmptyCount: nonEmpty.length,
    nullCount: filtered.length - nonEmpty.length,
    uniqueCount: freq.size,
    topCategories,
  };
}

export function executeCorrelation(
  rows: Record<string, string>[],
  colA: string,
  colB: string,
  filters?: FilterCondition[]
) {
  const filtered = applyFilters(rows, filters);
  const pairs: [number, number][] = [];

  for (const r of filtered) {
    const a = parseNumericValue(r[colA]);
    const b = parseNumericValue(r[colB]);
    if (a !== null && b !== null) pairs.push([a, b]);
  }

  if (pairs.length < 2) {
    return {
      colA,
      colB,
      validPairs: pairs.length,
      pearsonR: null,
      note: 'Not enough valid numeric pairs to compute correlation.',
    };
  }

  const n = pairs.length;
  const meanA = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanB = pairs.reduce((s, p) => s + p[1], 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (const [a, b] of pairs) {
    const da = a - meanA;
    const db = b - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const denom = Math.sqrt(denA * denB);
  const r = denom === 0 ? 0 : num / denom;

  return {
    colA,
    colB,
    validPairs: n,
    pearsonR: Number(r.toFixed(4)),
    meanA: Number(meanA.toFixed(4)),
    meanB: Number(meanB.toFixed(4)),
  };
}
