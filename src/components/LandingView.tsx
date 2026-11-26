import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Database,
  FileSpreadsheet,
  Search,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react';
import { SAMPLE_DATASETS, type SampleDatasetDef } from '../data/sampleDatasets.ts';
import { executeAggregateData } from '../shared/csvEngine.ts';
import { parseCsvString } from '../utils/csvParser.ts';

interface LandingViewProps {
  isUploading: boolean;
  onOpenWorkspace: () => void;
  onOpenProfile: () => void;
  onFileSelected: (file: File) => void;
  onSelectSample: (sample: SampleDatasetDef) => void;
}

const HERO_IMAGE = '/src/assets/images/hero_tabular_workbench_1795706331215.jpg';
const QUERY_ENGINE_IMAGE = '/src/assets/images/bento_query_engine_1795706331069.jpg';
const CHART_SYNTHESIS_IMAGE = '/src/assets/images/bento_chart_synthesis_1795706332023.jpg';

interface PreviewScenario {
  id: string;
  label: string;
  prompt: string;
  toolUsed: string;
  insight: string;
  unitPrefix?: string;
  bars: { label: string; value: number }[];
}

function ResilientImage({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 text-center ${className ?? ''}`}
      >
        <BarChart3 className="h-8 w-8 text-blue-400" />
        <span className="mt-2 text-xs font-medium text-slate-300">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function LandingView({
  isUploading,
  onOpenWorkspace,
  onOpenProfile,
  onFileSelected,
  onSelectSample,
}: LandingViewProps) {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute genuine verified preview numbers from the built-in SaaS sample dataset
  const scenarios = useMemo<PreviewScenario[]>(() => {
    const sample = SAMPLE_DATASETS[0];
    const parsed = parseCsvString(sample.csvText, sample.filename);

    const byRegion = executeAggregateData(parsed.rows, parsed.headers, {
      groupBy: ['Region'],
      metrics: [{ op: 'sum', column: 'MRR', alias: 'total_mrr' }],
      sortBy: 'total_mrr',
      sortDir: 'desc',
      limit: 4,
    });

    const byPlan = executeAggregateData(parsed.rows, parsed.headers, {
      groupBy: ['Plan'],
      metrics: [{ op: 'avg', column: 'MRR', alias: 'avg_mrr' }],
      sortBy: 'avg_mrr',
      sortDir: 'desc',
      limit: 3,
    });

    const byRisk = executeAggregateData(parsed.rows, parsed.headers, {
      groupBy: ['ChurnRisk'],
      metrics: [{ op: 'count', alias: 'accounts' }],
      sortBy: 'accounts',
      sortDir: 'desc',
      limit: 3,
    });

    return [
      {
        id: 'region',
        label: 'MRR by Region',
        prompt: 'What is total monthly recurring revenue across each region?',
        toolUsed: 'aggregate_data(groupBy: ["Region"], sum: "MRR")',
        insight: `${String(byRegion.results[0]?.Region ?? 'North America')} leads total MRR at $${Number(
          byRegion.results[0]?.total_mrr ?? 0
        ).toLocaleString()} across ${parsed.rows.length} accounts.`,
        unitPrefix: '$',
        bars: byRegion.results.map((r) => ({
          label: String(r.Region ?? ''),
          value: Number(r.total_mrr ?? 0),
        })),
      },
      {
        id: 'plan',
        label: 'Avg MRR by Plan',
        prompt: 'Compare average MRR across Starter, Growth, and Enterprise tiers.',
        toolUsed: 'aggregate_data(groupBy: ["Plan"], avg: "MRR")',
        insight: `Enterprise accounts average $${Math.round(
          Number(byPlan.results[0]?.avg_mrr ?? 0)
        ).toLocaleString()}/mo vs. $${Math.round(
          Number(byPlan.results[byPlan.results.length - 1]?.avg_mrr ?? 0)
        ).toLocaleString()}/mo on Starter.`,
        unitPrefix: '$',
        bars: byPlan.results.map((r) => ({
          label: String(r.Plan ?? ''),
          value: Math.round(Number(r.avg_mrr ?? 0)),
        })),
      },
      {
        id: 'risk',
        label: 'Churn Risk Mix',
        prompt: 'How many customer accounts fall into each churn risk tier?',
        toolUsed: 'aggregate_data(groupBy: ["ChurnRisk"], count)',
        insight: `${Number(byRisk.results[0]?.accounts ?? 0)} accounts sit in ${String(
          byRisk.results[0]?.ChurnRisk ?? 'Low'
        )} risk out of ${parsed.rows.length} total rows.`,
        bars: byRisk.results.map((r) => ({
          label: `${String(r.ChurnRisk ?? '')} Risk`,
          value: Number(r.accounts ?? 0),
        })),
      },
    ];
  }, []);

  const currentScenario = scenarios[activeScenarioIdx] ?? scenarios[0];
  const maxBarValue = Math.max(...currentScenario.bars.map((b) => b.value), 1);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = '';
        }}
      />

      {/* Section 1: Centered Hero + Interactive Showcase + Capability Strip */}
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <div className="space-y-10">
            {/* Centered Editorial Headline + Value Prop + Primary CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center"
            >
              <div className="space-y-4">
                <p className="text-xs font-medium tracking-wide text-blue-600 dark:text-blue-400">
                  Conversational CSV Workbench · Deterministic Query Engine
                </p>
                <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-5xl lg:text-6xl dark:text-slate-100">
                  Interrogate every row without writing a single formula.
                </h1>
                <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  Drop any spreadsheet to inspect column distributions, run exact server-verified aggregations, and synthesize interactive SVG charts and downloadable tables from plain English.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={onOpenWorkspace}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Open live workbench
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Upload className="h-4 w-4" />
                    Upload your CSV
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>Pre-loaded with 3 sample datasets</span>
                  <span aria-hidden="true">·</span>
                  <span>Comma, tab, or semicolon CSVs</span>
                  <span aria-hidden="true">·</span>
                  <span>Zero-hallucination tool math</span>
                </div>
              </div>
            </motion.div>

            {/* Centered Hero Visual + Interactive Live Query Preview */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="relative mx-auto min-h-[360px] max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800"
            >
              <ResilientImage
                src={HERO_IMAGE}
                alt="Translucent glass data layers and precision slate ledger blocks"
                fallbackTitle="Tabular Analytical Workbench"
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/20" />

              <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
                {/* Interactive Query Switcher Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-medium text-slate-300">
                    saas_revenue_ledger.csv · 180 rows
                  </span>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 backdrop-blur-sm">
                    {scenarios.map((sc, idx) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setActiveScenarioIdx(idx)}
                        className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          idx === activeScenarioIdx
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Computed Preview Card */}
                <div className="mt-8 rounded-lg border border-white/15 bg-slate-950/85 p-4 backdrop-blur-md">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentScenario.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-100">
                          &ldquo;{currentScenario.prompt}&rdquo;
                        </div>
                        <div className="truncate font-mono text-[11px] text-blue-400">
                          {currentScenario.toolUsed}
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        {currentScenario.bars.map((bar) => {
                          const widthPct = Math.max(8, Math.round((bar.value / maxBarValue) * 100));
                          return (
                            <div key={bar.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-300">{bar.label}</span>
                                <span className="font-mono font-semibold tabular-nums text-white">
                                  {currentScenario.unitPrefix ?? ''}
                                  {bar.value.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-xs bg-slate-800">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${widthPct}%` }}
                                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                  className="h-full bg-blue-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <p className="border-t border-white/10 pt-2.5 text-xs leading-relaxed text-slate-300">
                        {currentScenario.insight}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 4-Column Capability Strip below Hero Split */}
          <div className="mt-10 grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="p-5">
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                4 tools
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Filter, group-by aggregate, percentiles, and Pearson correlation run directly on your rows.
              </div>
            </div>
            <div className="p-5">
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                6 types
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Auto-detects currency, percentages, numbers, dates, booleans, and text categories.
              </div>
            </div>
            <div className="p-5">
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                3 chart modes
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Generates interactive bar, time-series line, and donut SVG charts with hover precision.
              </div>
            </div>
            <div className="p-5">
              <div className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                1-click CSV
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Download any filtered spreadsheet view or AI-generated summary table straight to disk.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Asymmetric Bento Grid of Core Features */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto mb-10 max-w-2xl space-y-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-3xl dark:text-slate-100">
            Everything built into the Tabular workbench
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Every view shares the same underlying CSV engine so numbers stay consistent across your data grid, column profile, and chat thread.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 01. Marquee Feature (col-span-2) */}
          <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-12 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between p-6 md:col-span-7">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>01. Tool-Verified Analysis Thread</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Exact row math before every answer
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Instead of guessing totals from a few sample lines, Gemini selects and executes deterministic tools on the server across your full dataset, then synthesizes clear prose and follow-up prompts.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:text-slate-300">
                <div className="rounded border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
                  query_rows
                </div>
                <div className="rounded border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
                  aggregate_data
                </div>
                <div className="rounded border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
                  column_statistics
                </div>
                <div className="rounded border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
                  correlate_columns
                </div>
              </div>
            </div>

            <div className="relative min-h-[240px] border-t border-slate-200 md:col-span-5 md:border-t-0 md:border-l dark:border-slate-800">
              <ResilientImage
                src={QUERY_ENGINE_IMAGE}
                alt="Isometric stacked frosted glass spreadsheet layers intersected by a cobalt beam"
                fallbackTitle="Deterministic Query Engine"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* 02. Column Profiling (col-span-1) */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Database className="h-3.5 w-3.5" />
                <span>02. Automated Column Profile</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Instant schema &amp; health audit
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Spot missing values, unique counts, min/median/max bounds, and top category frequencies for every column in one table—with one-click AI deep dives.
              </p>
            </div>

            <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-700 dark:text-slate-300">MRR (currency)</span>
                <span className="text-slate-500 dark:text-slate-400">$185 – $5,875</span>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-slate-700 dark:text-slate-300">NRR_Percent (%)</span>
                <span className="text-slate-500 dark:text-slate-400">median 113%</span>
              </div>
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Inspect Column Profile
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 03. Chart & Table Synthesis (col-span-1) */}
          <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="aspect-[16/9] w-full overflow-hidden border-b border-slate-200 dark:border-slate-800">
              <ResilientImage
                src={CHART_SYNTHESIS_IMAGE}
                alt="Stepped cobalt-blue and charcoal chart blocks on travertine stone"
                fallbackTitle="Chart & Table Synthesis"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-2.5 p-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>03. Inline Visuals &amp; Exports</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Charts and tables ready to share
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Questions about trends, shares, or rankings automatically attach interactive bar, line, or donut SVG charts plus downloadable CSV summary tables.
              </p>
            </div>
          </div>

          {/* 04. High-Density Data Grid + Transparency (col-span-2) */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Table2 className="h-3.5 w-3.5" />
                  <span>04. High-Density Split Workbench</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Search, sort, and verify side by side
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Browse paginated rows with type-aware sorting, instant client-side text search, and switch between Split View, Data Grid, or Chat Only at any moment.
                </p>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Search className="h-3.5 w-3.5" />
                  <span>05. Inspectable Calculation &amp; Bookmarks</span>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Expand any AI response to inspect the exact query parameters executed.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Bookmark key answers and charts into Saved Insights across visits.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Supports light and dark workspace modes with tabular numeral alignment.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ready to test on real rows? Jump straight into the pre-loaded ledger.
              </span>
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                Open Split Workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Drop CSV or Launch Any Sample Dataset */}
      <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid items-stretch gap-8 lg:grid-cols-12">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col justify-between rounded-xl border border-dashed p-8 transition-colors lg:col-span-5 ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/50'
              }`}
            >
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Start with your own spreadsheet
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Drag and drop a .csv or .tsv file here, or click below to browse from your computer.
                </p>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Loading CSV...' : 'Choose CSV file'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
              {SAMPLE_DATASETS.map((sample) => (
                <div
                  key={sample.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
                >
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {sample.title}
                    </h3>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {sample.rowCountLabel}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {sample.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => onSelectSample(sample)}
                    className="mt-4 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Load dataset
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 px-6 py-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Tabular
            </span>
            <span aria-hidden="true">·</span>
            <span>Conversational CSV analysis workbench</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="hover:text-slate-900 dark:hover:text-slate-100"
            >
              Workspace
            </button>
            <button
              type="button"
              onClick={onOpenProfile}
              className="hover:text-slate-900 dark:hover:text-slate-100"
            >
              Column Profile
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
