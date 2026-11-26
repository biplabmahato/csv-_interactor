import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
} from '@google/genai';
import {
  executeAggregateData,
  executeColumnStatistics,
  executeCorrelation,
  executeQueryRows,
  profileDataset,
} from './src/shared/csvEngine.ts';
import type {
  ChartSpec,
  DatasetSummary,
  FilterCondition,
  QueryTrace,
  TableSpec,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StoredDataset {
  id: string;
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  summary: DatasetSummary;
  createdAt: number;
}

const datasetStore = new Map<string, StoredDataset>();
const MAX_STORED_DATASETS = 16;

function saveDatasetInStore(
  name: string,
  headers: string[],
  rows: Record<string, string>[],
  fileSizeBytes: number
): StoredDataset {
  if (datasetStore.size >= MAX_STORED_DATASETS) {
    const oldestKey = datasetStore.keys().next().value;
    if (oldestKey) datasetStore.delete(oldestKey);
  }
  const id = crypto.randomUUID();
  const summary = profileDataset(name, rows, headers, fileSizeBytes);
  const entry: StoredDataset = {
    id,
    name,
    headers,
    rows,
    summary,
    createdAt: Date.now(),
  };
  datasetStore.set(id, entry);
  return entry;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const filterSchema = {
  type: Type.ARRAY,
  description: 'Optional list of AND-combined row filter conditions.',
  items: {
    type: Type.OBJECT,
    properties: {
      column: { type: Type.STRING, description: 'Exact column name' },
      operator: {
        type: Type.STRING,
        description:
          'One of: eq, neq, contains, not_contains, gt, gte, lt, lte, is_empty, not_empty',
      },
      value: {
        type: Type.STRING,
        description: 'Comparison value (omit for is_empty / not_empty)',
      },
    },
    required: ['column', 'operator'],
  },
};

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'query_rows',
    description:
      'Filter, sort, and inspect specific rows from the CSV dataset. Use this for record-level lookups, top/bottom N individual rows, or checking exact text values.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filters: filterSchema,
        selectColumns: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Subset of column names to return. Omit for all columns.',
        },
        sortBy: { type: Type.STRING, description: 'Column name to sort by' },
        sortDir: {
          type: Type.STRING,
          description: "Sort direction: 'asc' or 'desc'",
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum rows to return (1 to 50, default 20)',
        },
      },
    },
  },
  {
    name: 'aggregate_data',
    description:
      'Group rows by 0, 1, or more columns and compute exact counts, sums, averages, mins, maxes, or medians. Always use this tool for totals, breakdowns, rankings, or time trends.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filters: filterSchema,
        groupBy: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Column names to group by. Pass empty array [] to compute overall aggregates across all matching rows.',
        },
        dateBucket: {
          type: Type.STRING,
          description:
            "Optional date granularity when grouping by a date column: 'month', 'year', or 'day'.",
        },
        metrics: {
          type: Type.ARRAY,
          description: 'Metrics to compute for each group.',
          items: {
            type: Type.OBJECT,
            properties: {
              op: {
                type: Type.STRING,
                description: "One of: 'count', 'sum', 'avg', 'min', 'max', 'median'",
              },
              column: {
                type: Type.STRING,
                description: 'Column to aggregate (optional when op is count)',
              },
              alias: {
                type: Type.STRING,
                description: 'Short readable output field name',
              },
            },
            required: ['op'],
          },
        },
        sortBy: {
          type: Type.STRING,
          description: 'Group column name or metric alias to sort by',
        },
        sortDir: {
          type: Type.STRING,
          description: "Sort direction: 'asc' or 'desc'",
        },
        limit: {
          type: Type.INTEGER,
          description: 'Maximum groups to return (default 25)',
        },
      },
      required: ['metrics'],
    },
  },
  {
    name: 'column_statistics',
    description:
      'Compute detailed distribution, percentiles (p25, median, p75, p90), standard deviation, null counts, and top category frequencies for a single column.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        column: { type: Type.STRING, description: 'Exact column name' },
        filters: filterSchema,
      },
      required: ['column'],
    },
  },
  {
    name: 'correlate_columns',
    description:
      'Compute Pearson correlation coefficient (r) and valid pair count between two numeric columns.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        colA: { type: Type.STRING, description: 'First numeric column name' },
        colB: { type: Type.STRING, description: 'Second numeric column name' },
        filters: filterSchema,
      },
      required: ['colA', 'colB'],
    },
  },
  {
    name: 'attach_chart',
    description:
      'Attach an interactive visual chart to your answer using verified numbers computed from the dataset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        chartType: {
          type: Type.STRING,
          description: "One of: 'bar', 'line', 'donut'",
        },
        title: { type: Type.STRING, description: 'Concise chart title' },
        subtitle: { type: Type.STRING, description: 'Optional one-line context' },
        xLabel: { type: Type.STRING, description: 'X-axis or category label' },
        yLabel: { type: Type.STRING, description: 'Y-axis or metric label' },
        valuePrefix: { type: Type.STRING, description: "Optional prefix e.g. '$'" },
        valueSuffix: { type: Type.STRING, description: "Optional suffix e.g. '%'" },
        data: {
          type: Type.ARRAY,
          description: 'Data points (keep between 2 and 24 points for clarity)',
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              value: { type: Type.NUMBER },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['chartType', 'title', 'data'],
    },
  },
  {
    name: 'attach_table',
    description:
      'Attach a structured data table to your answer for top rankings, comparisons, or filtered record subsets.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Concise table title' },
        columns: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        rows: {
          type: Type.ARRAY,
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
      required: ['title', 'columns', 'rows'],
    },
  },
  {
    name: 'suggest_followups',
    description:
      'Provide 2 to 3 concise follow-up questions the user might ask next based on this dataset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['questions'],
    },
  },
];

function formatDatasetContext(summary: DatasetSummary): string {
  const colLines = summary.columns.map((c) => {
    const parts = [`- "${c.name}" (${c.type})`, `non-null: ${c.nonNullCount}`, `unique: ${c.uniqueCount}`];
    if (c.min !== undefined && c.max !== undefined) {
      parts.push(`min: ${c.min}`, `max: ${c.max}`, `mean: ${c.mean}`, `sum: ${c.sum}`);
    } else if (c.topValues.length > 0) {
      const top = c.topValues
        .slice(0, 4)
        .map((t) => `${t.value} (${t.count})`)
        .join(', ');
      parts.push(`top: [${top}]`);
    }
    return parts.join(' | ');
  });

  const samplePreview = JSON.stringify(summary.sampleRows.slice(0, 5), null, 2);

  return [
    `Dataset: "${summary.name}"`,
    `Dimensions: ${summary.rowCount} rows x ${summary.columnCount} columns`,
    `Columns:\n${colLines.join('\n')}`,
    `First 5 sample rows:\n${samplePreview}`,
  ].join('\n\n');
}

function summarizeTrace(name: string, args: Record<string, unknown>, result: unknown): string {
  if (name === 'query_rows') {
    const res = result as { totalMatchingRows?: number; returnedRows?: number };
    return `Matched ${res.totalMatchingRows ?? 0} rows (inspected ${res.returnedRows ?? 0})`;
  }
  if (name === 'aggregate_data') {
    const res = result as { totalFilteredRows?: number; totalGroups?: number };
    const grp = Array.isArray(args.groupBy) && args.groupBy.length > 0 ? args.groupBy.join(', ') : 'all rows';
    return `Grouped ${res.totalFilteredRows ?? 0} rows by ${grp} (${res.totalGroups ?? 0} groups)`;
  }
  if (name === 'column_statistics') {
    return `Computed distribution and percentiles for "${String(args.column ?? '')}"`;
  }
  if (name === 'correlate_columns') {
    const res = result as { pearsonR?: number | null };
    return `Correlation between "${String(args.colA ?? '')}" and "${String(args.colB ?? '')}": r = ${res.pearsonR ?? 'N/A'}`;
  }
  return `Executed ${name}`;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, datasetsInMemory: datasetStore.size });
  });

  app.post('/api/datasets', (req, res) => {
    try {
      const { name, headers, rows, fileSizeBytes } = req.body as {
        name?: string;
        headers?: string[];
        rows?: Record<string, string>[];
        fileSizeBytes?: number;
      };

      if (!name || !Array.isArray(headers) || !Array.isArray(rows)) {
        res.status(400).json({ error: 'Invalid dataset payload: name, headers, and rows are required.' });
        return;
      }

      if (headers.length === 0) {
        res.status(400).json({ error: 'CSV must contain at least one column header.' });
        return;
      }

      const stored = saveDatasetInStore(
        name,
        headers,
        rows,
        typeof fileSizeBytes === 'number' ? fileSizeBytes : 0
      );

      res.json({
        datasetId: stored.id,
        summary: stored.summary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register dataset.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { datasetId, question, history, datasetFallback } = req.body as {
        datasetId?: string;
        question?: string;
        history?: { role: 'user' | 'assistant'; content: string }[];
        datasetFallback?: {
          name: string;
          headers: string[];
          rows: Record<string, string>[];
          fileSizeBytes?: number;
        };
      };

      if (!question || typeof question !== 'string' || !question.trim()) {
        res.status(400).json({ error: 'Please enter a question to analyze the CSV.' });
        return;
      }

      let stored = datasetId ? datasetStore.get(datasetId) : undefined;
      let activeDatasetId = datasetId;

      if (!stored && datasetFallback && Array.isArray(datasetFallback.headers) && Array.isArray(datasetFallback.rows)) {
        stored = saveDatasetInStore(
          datasetFallback.name || 'dataset.csv',
          datasetFallback.headers,
          datasetFallback.rows,
          datasetFallback.fileSizeBytes ?? 0
        );
        activeDatasetId = stored.id;
      }

      if (!stored) {
        res.status(404).json({
          error: 'Dataset session was not found. Please reload the CSV.',
          code: 'DATASET_EXPIRED',
        });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getGenAIClient();
      } catch (e) {
        if (e instanceof Error && e.message === 'MISSING_API_KEY') {
          res.status(503).json({
            error:
              'Gemini API key is not configured. Please check your key in the Settings > Secrets panel.',
          });
          return;
        }
        throw e;
      }

      const systemInstruction = [
        'You are Tabular, a precise data analyst helping the user explore and analyze their uploaded CSV dataset.',
        'RULES:',
        '1. ALWAYS use the provided data tools (`aggregate_data`, `query_rows`, `column_statistics`, `correlate_columns`) before stating ANY numbers, totals, counts, averages, or rankings. NEVER guess or extrapolate numbers from the 5 sample rows.',
        '2. Use exact column names from the schema below.',
        '3. When a question asks for comparisons, trends over time, breakdowns by category, or top-N rankings, call `attach_chart` with the exact verified data you obtained from the tools. Use `line` for chronological/time trends, `donut` for <= 6 part-to-whole shares, and `bar` for rankings or category comparisons.',
        '4. When returning a ranking, subset of records, or multi-metric summary table, call `attach_table` so the user gets a clean, downloadable table.',
        '5. Call `suggest_followups` with 2-3 insightful next questions tailored to the dataset.',
        '6. Write a concise, clear final answer in Markdown highlighting the key findings with exact figures and units. Do not invent fake metrics or commentary outside the data.',
        '',
        formatDatasetContext(stored.summary),
      ].join('\n');

      const contents: Content[] = [];
      if (Array.isArray(history)) {
        for (const msg of history.slice(-8)) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: question.trim() }],
      });

      const charts: ChartSpec[] = [];
      const tables: TableSpec[] = [];
      const traces: QueryTrace[] = [];
      let followUps: string[] = [];
      let finalAnswer = '';

      const MAX_ROUNDS = 6;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: toolDeclarations }],
          },
        });

        const candidateContent = response.candidates?.[0]?.content;
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
          finalAnswer = (response.text ?? '').trim();
          break;
        }

        if (candidateContent) {
          contents.push(candidateContent);
        }

        const responseParts: Part[] = [];

        for (const call of functionCalls) {
          const name = call.name ?? '';
          const args = (call.args ?? {}) as Record<string, unknown>;
          let toolResult: unknown;

          if (name === 'query_rows') {
            toolResult = executeQueryRows(stored.rows, stored.headers, {
              filters: args.filters as FilterCondition[] | undefined,
              selectColumns: args.selectColumns as string[] | undefined,
              sortBy: args.sortBy as string | undefined,
              sortDir: (args.sortDir as 'asc' | 'desc' | undefined) ?? 'asc',
              limit: typeof args.limit === 'number' ? args.limit : 20,
            });
            traces.push({
              tool: 'query_rows',
              args,
              summary: summarizeTrace('query_rows', args, toolResult),
            });
          } else if (name === 'aggregate_data') {
            toolResult = executeAggregateData(stored.rows, stored.headers, {
              filters: args.filters as FilterCondition[] | undefined,
              groupBy: args.groupBy as string[] | undefined,
              dateBucket: args.dateBucket as 'month' | 'year' | 'day' | undefined,
              metrics: Array.isArray(args.metrics)
                ? (args.metrics as {
                    column?: string;
                    op: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'median';
                    alias?: string;
                  }[])
                : [{ op: 'count', alias: 'count' }],
              sortBy: args.sortBy as string | undefined,
              sortDir: (args.sortDir as 'asc' | 'desc' | undefined) ?? 'desc',
              limit: typeof args.limit === 'number' ? args.limit : 25,
            });
            traces.push({
              tool: 'aggregate_data',
              args,
              summary: summarizeTrace('aggregate_data', args, toolResult),
            });
          } else if (name === 'column_statistics') {
            toolResult = executeColumnStatistics(
              stored.rows,
              String(args.column ?? ''),
              args.filters as FilterCondition[] | undefined
            );
            traces.push({
              tool: 'column_statistics',
              args,
              summary: summarizeTrace('column_statistics', args, toolResult),
            });
          } else if (name === 'correlate_columns') {
            toolResult = executeCorrelation(
              stored.rows,
              String(args.colA ?? ''),
              String(args.colB ?? ''),
              args.filters as FilterCondition[] | undefined
            );
            traces.push({
              tool: 'correlate_columns',
              args,
              summary: summarizeTrace('correlate_columns', args, toolResult),
            });
          } else if (name === 'attach_chart') {
            const rawData = Array.isArray(args.data) ? args.data : [];
            const cleanData = rawData
              .map((d: unknown) => {
                const item = d as { label?: unknown; value?: unknown };
                return {
                  label: String(item.label ?? ''),
                  value: Number(item.value ?? 0),
                };
              })
              .filter((d) => d.label.length > 0 && Number.isFinite(d.value));

            if (cleanData.length > 0) {
              const chartType =
                args.chartType === 'line' || args.chartType === 'donut' ? args.chartType : 'bar';
              charts.push({
                id: crypto.randomUUID(),
                chartType,
                title: String(args.title ?? 'Chart'),
                subtitle: args.subtitle ? String(args.subtitle) : undefined,
                xLabel: args.xLabel ? String(args.xLabel) : undefined,
                yLabel: args.yLabel ? String(args.yLabel) : undefined,
                valuePrefix: args.valuePrefix ? String(args.valuePrefix) : undefined,
                valueSuffix: args.valueSuffix ? String(args.valueSuffix) : undefined,
                data: cleanData,
              });
            }
            toolResult = { attached: true, points: cleanData.length };
          } else if (name === 'attach_table') {
            const cols = Array.isArray(args.columns) ? args.columns.map(String) : [];
            const tRows = Array.isArray(args.rows)
              ? args.rows.map((r: unknown) => (Array.isArray(r) ? r.map((v) => (v === null ? null : String(v))) : []))
              : [];
            if (cols.length > 0 && tRows.length > 0) {
              tables.push({
                id: crypto.randomUUID(),
                title: String(args.title ?? 'Results'),
                columns: cols,
                rows: tRows,
              });
            }
            toolResult = { attached: true, rows: tRows.length };
          } else if (name === 'suggest_followups') {
            if (Array.isArray(args.questions)) {
              followUps = args.questions.map(String).filter(Boolean).slice(0, 3);
            }
            toolResult = { saved: followUps.length };
          } else {
            toolResult = { error: `Unknown tool: ${name}` };
          }

          responseParts.push({
            functionResponse: {
              id: call.id,
              name,
              response: { result: toolResult },
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });

        // If we are on the final round, force a summary text response without tools
        if (round === MAX_ROUNDS - 1 && !finalAnswer) {
          const finalResp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction:
                systemInstruction +
                '\nProvide your final concise Markdown answer now using only the verified tool results already retrieved.',
            },
          });
          finalAnswer = (finalResp.text ?? '').trim();
        }
      }

      if (!finalAnswer) {
        finalAnswer =
          charts.length > 0 || tables.length > 0
            ? 'Here are the verified results from your dataset.'
            : 'I analyzed the dataset, but could not produce a summary. Try rephrasing your question.';
      }

      res.json({
        datasetId: activeDatasetId,
        answer: finalAnswer,
        charts,
        tables,
        traces,
        followUps,
      });
    } catch (err: unknown) {
      console.error('Chat API error:', err);
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred while querying Gemini.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tabular server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
