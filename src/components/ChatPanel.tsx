import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  Send,
} from 'lucide-react';
import type { ChatMessage, TableSpec } from '../shared/types.ts';
import { downloadCsvFromTable } from '../utils/csvParser.ts';
import { DataChart } from './DataChart.tsx';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';

interface ChatPanelProps {
  datasetName: string;
  messages: ChatMessage[];
  starterQuestions: string[];
  isLoading: boolean;
  savedIds: Set<string>;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onSaveInsight: (question: string, message: ChatMessage) => void;
}

function ResultTable({ table }: { table: TableSpec }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
        <h4 className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {table.title}
        </h4>
        <button
          type="button"
          onClick={() =>
            downloadCsvFromTable(
              table.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
              table.columns,
              table.rows
            )
          }
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download className="h-3 w-3" />
          Download CSV
        </button>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              {table.columns.map((col, idx) => (
                <th
                  key={idx}
                  className="border-b border-slate-200 px-3 py-2 font-semibold whitespace-nowrap dark:border-slate-800"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3 py-1.5 font-mono text-[11px] tabular-nums text-slate-700 whitespace-nowrap dark:text-slate-300"
                  >
                    {cell === null ? '—' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ChatPanel({
  datasetName,
  messages,
  starterQuestions,
  isLoading,
  savedIds,
  onSendMessage,
  onClearChat,
  onSaveInsight,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set());
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  const toggleTrace = (id: string) => {
    setExpandedTraceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSendMessage(input.trim());
        setInput('');
      }
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950">
      {/* Thread Sub-Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            Analysis thread
          </h2>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            New thread
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg space-y-5 pt-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ask anything about {datasetName}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Questions are computed directly against your rows before generating summaries, tables, and charts.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Suggested prompts
              </div>
              <div className="space-y-2">
                {starterQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isLoading}
                    onClick={() => onSendMessage(q)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-slate-900 px-3.5 py-2.5 text-sm text-white dark:bg-blue-600">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const precedingQuestion =
                idx > 0 && messages[idx - 1].role === 'user'
                  ? messages[idx - 1].content
                  : 'Analysis query';
              const isSaved = savedIds.has(msg.id);
              const traceOpen = expandedTraceIds.has(msg.id);

              return (
                <div key={msg.id} className="space-y-3">
                  {msg.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                      {msg.error}
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <MarkdownRenderer content={msg.content} />

                      {msg.charts && msg.charts.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {msg.charts.map((chart) => (
                            <DataChart key={chart.id} chart={chart} />
                          ))}
                        </div>
                      )}

                      {msg.tables && msg.tables.length > 0 && (
                        <div className="space-y-3 pt-1">
                          {msg.tables.map((tbl) => (
                            <ResultTable key={tbl.id} table={tbl} />
                          ))}
                        </div>
                      )}

                      {/* Footer actions: calculation trace + save insight */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          {msg.traces && msg.traces.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleTrace(msg.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            >
                              {traceOpen ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              Inspect calculation ({msg.traces.length})
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onSaveInsight(precedingQuestion, msg)}
                          disabled={isSaved}
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors ${
                            isSaved
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <BookmarkCheck className="h-3.5 w-3.5" />
                              Saved
                            </>
                          ) : (
                            <>
                              <Bookmark className="h-3.5 w-3.5" />
                              Save insight
                            </>
                          )}
                        </button>
                      </div>

                      {traceOpen && msg.traces && (
                        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                          {msg.traces.map((tr, tIdx) => (
                            <div key={tIdx} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                  {tr.tool}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">{tr.summary}</span>
                              </div>
                              <pre className="overflow-x-auto font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {JSON.stringify(tr.args)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.followUps.map((fq) => (
                        <button
                          key={fq}
                          type="button"
                          disabled={isLoading}
                          onClick={() => onSendMessage(fq)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
                        >
                          {fq}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-600 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-blue-500 dark:focus-within:bg-slate-900">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your CSV..."
            aria-label="Ask a question about your CSV"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send question"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
