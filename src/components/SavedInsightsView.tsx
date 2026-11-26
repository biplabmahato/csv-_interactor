import { Trash2 } from 'lucide-react';
import type { SavedInsight } from '../shared/types.ts';
import { DataChart } from './DataChart.tsx';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';

interface SavedInsightsViewProps {
  insights: SavedInsight[];
  onRemoveInsight: (id: string) => void;
  onGoToDatasets: () => void;
}

export function SavedInsightsView({
  insights,
  onRemoveInsight,
  onGoToDatasets,
}: SavedInsightsViewProps) {
  if (insights.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md space-y-3 text-center">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No saved insights yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Save any answer, chart, or calculation from an analysis thread to keep it bookmarked here for reference.
          </p>
          <button
            type="button"
            onClick={onGoToDatasets}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Explore datasets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Saved insights
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {insights.length} bookmarked {insights.length === 1 ? 'analysis' : 'analyses'} stored locally in your browser
          </p>
        </div>

        <div className="space-y-4">
          {insights.map((item) => (
            <div
              key={item.id}
              className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="min-w-0 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.datasetName}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">
                      {new Date(item.savedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.question}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveInsight(item.id)}
                  aria-label="Remove saved insight"
                  className="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <MarkdownRenderer content={item.message.content} />

              {item.message.charts && item.message.charts.length > 0 && (
                <div className="grid gap-3 pt-1">
                  {item.message.charts.map((c) => (
                    <DataChart key={c.id} chart={c} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
