import Papa from 'papaparse';

export interface ParsedCsvResult {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  fileSizeBytes: number;
}

function normalizeHeaders(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((h, idx) => {
    const base = h.replace(/^\uFEFF/, '').trim() || `Column_${idx + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export function parseCsvString(
  csvText: string,
  filename: string,
  fileSizeBytes?: number
): ParsedCsvResult {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    throw new Error('The CSV content is empty.');
  }

  const parsed = Papa.parse<string[]>(cleaned, {
    header: false,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(parsed.errors[0].message || 'Could not parse CSV file.');
  }

  const matrix = parsed.data;
  if (matrix.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = normalizeHeaders(matrix[0].map((v) => String(v ?? '')));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const rawRow = matrix[i];
    if (!rawRow || rawRow.every((cell) => String(cell ?? '').trim() === '')) {
      continue;
    }
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = rawRow[c] !== undefined && rawRow[c] !== null ? String(rawRow[c]) : '';
    }
    rows.push(obj);
  }

  if (rows.length === 0) {
    throw new Error('No data rows were found below the CSV header.');
  }

  return {
    name: filename,
    headers,
    rows,
    fileSizeBytes: fileSizeBytes ?? new Blob([csvText]).size,
  };
}

export async function parseCsvFile(file: File): Promise<ParsedCsvResult> {
  const text = await file.text();
  return parseCsvString(text, file.name, file.size);
}

export function downloadCsvFromTable(
  filename: string,
  columns: string[],
  rows: (string | number | null)[][]
) {
  const escapeCell = (val: string | number | null | undefined) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    columns.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
