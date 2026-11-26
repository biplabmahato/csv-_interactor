export type ColumnType = 'number' | 'currency' | 'percent' | 'date' | 'boolean' | 'string';

export interface ValueFrequency {
  value: string;
  count: number;
}

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  sum?: number;
  mean?: number;
  median?: number;
  topValues: ValueFrequency[];
  sampleValues: string[];
}

export interface DatasetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
  fileSizeBytes: number;
  columns: ColumnProfile[];
  sampleRows: Record<string, string>[];
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_empty'
  | 'not_empty';

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: string | number;
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface ChartSpec {
  id: string;
  chartType: 'bar' | 'line' | 'donut';
  title: string;
  subtitle?: string;
  xLabel?: string;
  yLabel?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  data: ChartDatum[];
}

export interface TableSpec {
  id: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export interface QueryTrace {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  traces?: QueryTrace[];
  followUps?: string[];
  error?: string;
}

export interface SavedInsight {
  id: string;
  datasetName: string;
  question: string;
  message: ChatMessage;
  savedAt: string;
}
