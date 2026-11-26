import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Moon, Sun } from 'lucide-react';
import { ChatPanel } from './components/ChatPanel.tsx';
import { ColumnProfileView } from './components/ColumnProfileView.tsx';
import { DataGrid } from './components/DataGrid.tsx';
import { LandingView } from './components/LandingView.tsx';
import { SavedInsightsView } from './components/SavedInsightsView.tsx';
import { UploadView } from './components/UploadView.tsx';
import {
  generateStarterQuestions,
  SAMPLE_DATASETS,
  type SampleDatasetDef,
} from './data/sampleDatasets.ts';
import { compareCellValues, profileDataset } from './shared/csvEngine.ts';
import type {
  ChatMessage,
  DatasetSummary,
  QueryTrace,
  SavedInsight,
  ChartSpec,
  TableSpec,
} from './shared/types.ts';
import {
  downloadCsvFromTable,
  formatBytes,
  parseCsvFile,
  parseCsvString,
  type ParsedCsvResult,
} from './utils/csvParser.ts';

type ActiveTab = 'landing' | 'workspace' | 'profile' | 'insights' | 'datasets';
type WorkspaceMode = 'split' | 'grid' | 'chat';

const SAVED_INSIGHTS_KEY = 'tabular_saved_insights_v1';
const THEME_STORAGE_KEY = 'tabular_theme_v1';

interface ActiveDatasetState {
  datasetId: string | null;
  parsed: ParsedCsvResult;
  summary: DatasetSummary;
}

function buildInitialDatasetState(): ActiveDatasetState {
  const sample = SAMPLE_DATASETS[0];
  const parsed = parseCsvString(sample.csvText, sample.filename);
  const summary = profileDataset(
    parsed.name,
    parsed.rows,
    parsed.headers,
    parsed.fileSizeBytes
  );
  return {
    datasetId: null,
    parsed,
    summary,
  };
}

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('split');
  const [dataset, setDataset] = useState<ActiveDatasetState | null>(() =>
    buildInitialDatasetState()
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_INSIGHTS_KEY);
      return raw ? (JSON.parse(raw) as SavedInsight[]) : [];
    } catch {
      return [];
    }
  });

  const headerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage failures
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_INSIGHTS_KEY, JSON.stringify(savedInsights));
    } catch {
      // Ignore storage quota issues
    }
  }, [savedInsights]);

  const registerDatasetOnServer = async (parsed: ParsedCsvResult) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const localSummary = profileDataset(
        parsed.name,
        parsed.rows,
        parsed.headers,
        parsed.fileSizeBytes
      );

      let serverDatasetId: string | null = null;
      let serverSummary: DatasetSummary = localSummary;

      const resp = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.name,
          headers: parsed.headers,
          rows: parsed.rows,
          fileSizeBytes: parsed.fileSizeBytes,
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as { datasetId: string; summary: DatasetSummary };
        serverDatasetId = data.datasetId;
        serverSummary = data.summary;
      }

      setDataset({
        datasetId: serverDatasetId,
        parsed,
        summary: serverSummary,
      });
      setMessages([]);
      setSearchQuery('');
      setSortColumn(null);
      setSortDirection('asc');
      setWorkspaceMode('split');
      setActiveTab('workspace');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load CSV dataset.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    setUploadError(null);
    try {
      const parsed = await parseCsvFile(file);
      await registerDatasetOnServer(parsed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    }
  };

  const handlePasteCsv = async (csvText: string, filename: string) => {
    setUploadError(null);
    try {
      const parsed = parseCsvString(csvText, filename);
      await registerDatasetOnServer(parsed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse pasted CSV.');
    }
  };

  const handleSelectSample = async (sample: SampleDatasetDef) => {
    setUploadError(null);
    try {
      const parsed = parseCsvString(sample.csvText, sample.filename);
      await registerDatasetOnServer(parsed);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load sample dataset.');
    }
  };

  const handleSortChange = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleExportCurrentGrid = () => {
    if (!dataset) return;
    const { headers, rows, name } = dataset.parsed;
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => headers.some((h) => (r[h] ?? '').toLowerCase().includes(q)))
      : rows;
    const sorted = sortColumn
      ? [...filtered].sort(
          (a, b) =>
            compareCellValues(a[sortColumn] ?? '', b[sortColumn] ?? '') *
            (sortDirection === 'desc' ? -1 : 1)
        )
      : filtered;

    const matrix = sorted.map((r) => headers.map((h) => r[h] ?? ''));
    const exportName = name.replace(/\.csv$/i, '') + (q ? '_filtered.csv' : '_export.csv');
    downloadCsvFromTable(exportName, headers, matrix);
  };

  const handleSendMessage = async (text: string) => {
    if (!dataset || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setIsChatLoading(true);

    try {
      const payload = {
        datasetId: dataset.datasetId ?? undefined,
        question: text,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        datasetFallback: {
          name: dataset.parsed.name,
          headers: dataset.parsed.headers,
          rows: dataset.parsed.rows,
          fileSizeBytes: dataset.parsed.fileSizeBytes,
        },
      };

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json()) as {
        datasetId?: string;
        answer?: string;
        charts?: ChartSpec[];
        tables?: TableSpec[];
        traces?: QueryTrace[];
        followUps?: string[];
        error?: string;
      };

      if (!resp.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            error: data.error || `Request failed with status ${resp.status}.`,
          },
        ]);
        return;
      }

      if (data.datasetId && data.datasetId !== dataset.datasetId) {
        setDataset((prev) => (prev ? { ...prev, datasetId: data.datasetId! } : prev));
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer || 'Analysis complete.',
        timestamp: new Date().toISOString(),
        charts: data.charts,
        tables: data.tables,
        traces: data.traces,
        followUps: data.followUps,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          error:
            err instanceof Error
              ? err.message
              : 'Network error communicating with the analysis server.',
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveInsight = (question: string, message: ChatMessage) => {
    if (!dataset) return;
    setSavedInsights((prev) => {
      if (prev.some((item) => item.id === message.id)) return prev;
      return [
        {
          id: message.id,
          datasetName: dataset.parsed.name,
          question,
          message,
          savedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const handleRemoveInsight = (id: string) => {
    setSavedInsights((prev) => prev.filter((item) => item.id !== id));
  };

  const savedIds = useMemo(
    () => new Set(savedInsights.map((i) => i.id)),
    [savedInsights]
  );

  const starterQuestions = useMemo(
    () => (dataset ? generateStarterQuestions(dataset.summary) : []),
    [dataset]
  );

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'landing', label: 'Overview' },
    { id: 'workspace', label: 'Workspace' },
    { id: 'profile', label: 'Column Profile' },
    { id: 'insights', label: 'Saved Insights' },
    { id: 'datasets', label: 'Datasets' },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Hidden file input for global Upload CSV CTA */}
      <input
        ref={headerFileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
      />

      {/* Strict 3-Zone Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('landing')}
          className="font-display shrink-0 whitespace-nowrap text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"
        >
          Tabular
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative shrink-0 whitespace-nowrap py-4 transition-colors ${
                  isActive
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => headerFileInputRef.current?.click()}
            className="shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Upload CSV
          </button>
        </div>
      </header>

      {/* Contextual Workspace Sub-Toolbar */}
      {dataset && (activeTab === 'workspace' || activeTab === 'profile') && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex min-w-0 items-center gap-3 text-xs">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {dataset.summary.name}
            </span>
            <span className="hidden text-slate-400 sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="hidden whitespace-nowrap font-mono tabular-nums text-slate-500 sm:inline dark:text-slate-400">
              {dataset.summary.rowCount.toLocaleString()} rows · {dataset.summary.columnCount} columns ·{' '}
              {formatBytes(dataset.summary.fileSizeBytes)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === 'workspace' && (
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                {(
                  [
                    { id: 'split', label: 'Split View' },
                    { id: 'grid', label: 'Data Grid' },
                    { id: 'chat', label: 'Chat Only' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setWorkspaceMode(mode.id)}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      workspaceMode === mode.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleExportCurrentGrid}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === 'landing' ? (
          <LandingView
            isUploading={isUploading}
            onOpenWorkspace={() => setActiveTab('workspace')}
            onOpenProfile={() => setActiveTab('profile')}
            onFileSelected={handleFileSelected}
            onSelectSample={handleSelectSample}
          />
        ) : activeTab === 'datasets' || (!dataset && activeTab !== 'insights') ? (
          <UploadView
            isUploading={isUploading}
            uploadError={uploadError}
            onFileSelected={handleFileSelected}
            onPasteCsv={handlePasteCsv}
            onSelectSample={handleSelectSample}
          />
        ) : activeTab === 'insights' ? (
          <SavedInsightsView
            insights={savedInsights}
            onRemoveInsight={handleRemoveInsight}
            onGoToDatasets={() => setActiveTab(dataset ? 'workspace' : 'datasets')}
          />
        ) : activeTab === 'profile' && dataset ? (
          <ColumnProfileView
            summary={dataset.summary}
            onAskAboutColumn={(q) => {
              setActiveTab('workspace');
              if (workspaceMode === 'grid') setWorkspaceMode('split');
              void handleSendMessage(q);
            }}
          />
        ) : dataset ? (
          <div
            className={`grid min-h-0 flex-1 ${
              workspaceMode === 'split'
                ? 'grid-cols-1 lg:grid-cols-12'
                : 'grid-cols-1'
            }`}
          >
            {workspaceMode !== 'chat' && (
              <section
                className={`min-h-0 overflow-hidden ${
                  workspaceMode === 'split'
                    ? 'border-b border-slate-200 lg:col-span-7 lg:border-r lg:border-b-0 dark:border-slate-800'
                    : ''
                }`}
              >
                <DataGrid
                  headers={dataset.parsed.headers}
                  rows={dataset.parsed.rows}
                  columns={dataset.summary.columns}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSortChange={handleSortChange}
                />
              </section>
            )}

            {workspaceMode !== 'grid' && (
              <section
                className={`min-h-0 overflow-hidden ${
                  workspaceMode === 'split' ? 'lg:col-span-5' : ''
                }`}
              >
                <ChatPanel
                  datasetName={dataset.summary.name}
                  messages={messages}
                  starterQuestions={starterQuestions}
                  isLoading={isChatLoading}
                  savedIds={savedIds}
                  onSendMessage={(q) => void handleSendMessage(q)}
                  onClearChat={() => setMessages([])}
                  onSaveInsight={handleSaveInsight}
                />
              </section>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
