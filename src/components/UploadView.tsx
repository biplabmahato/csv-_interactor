import { useRef, useState } from 'react';
import { ArrowRight, FileSpreadsheet, Upload } from 'lucide-react';
import { SAMPLE_DATASETS, type SampleDatasetDef } from '../data/sampleDatasets.ts';

interface UploadViewProps {
  isUploading: boolean;
  uploadError: string | null;
  onFileSelected: (file: File) => void;
  onPasteCsv: (csvText: string, filename: string) => void;
  onSelectSample: (sample: SampleDatasetDef) => void;
}

export function UploadView({
  isUploading,
  uploadError,
  onFileSelected,
  onPasteCsv,
  onSelectSample,
}: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('pasted_data.csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteText.trim()) return;
    onPasteCsv(pasteText, pasteName.trim() || 'pasted_data.csv');
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-12">
        {/* Left Column: Headline & Dropzone */}
        <div className="space-y-6 lg:col-span-7">
          <div className="space-y-3">
            <h1 className="max-w-xl text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl dark:text-slate-100">
              Ask questions of any CSV in plain English
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Drop a spreadsheet to inspect column distributions, run exact aggregations, and generate charts directly from your rows.
            </p>
          </div>

          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {uploadError}
            </div>
          )}

          {!showPaste ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border border-dashed p-10 text-center transition-colors ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/20'
                  : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
              }`}
            >
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
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Upload className="h-5 w-5" />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Drag and drop your CSV file here
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supports comma, tab, or semicolon delimited files up to 20 MB
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? 'Loading dataset...' : 'Select CSV file'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaste(true)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Paste CSV text
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handlePasteSubmit}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Paste raw CSV data
                </label>
                <input
                  type="text"
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                  placeholder="dataset.csv"
                  aria-label="Dataset filename"
                  className="w-44 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <textarea
                rows={8}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'Date,Category,Amount\n2026-01-05,Software,420\n2026-01-12,Hardware,1150'}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaste(false)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pasteText.trim() || isUploading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? 'Parsing...' : 'Load pasted CSV'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Sample Datasets */}
        <div className="space-y-4 lg:col-span-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sample datasets
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Load a curated spreadsheet immediately to explore the workbench.
            </p>
          </div>

          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {SAMPLE_DATASETS.map((sample) => (
              <div
                key={sample.id}
                className="p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {sample.title}
                      </h3>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {sample.filename} · {sample.rowCountLabel}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {sample.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => onSelectSample(sample)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Open in workbench
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
