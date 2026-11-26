# Tabular — Chat with your CSV

Tabular is a full-stack conversational CSV data workbench built with React, TypeScript, Tailwind CSS, Express, and the Gemini API (`@google/genai`). Upload or paste any CSV dataset, inspect column statistics, explore rows in a sortable/searchable grid, and ask natural-language questions backed by deterministic server-side data tools.

## Features

- **Landing Overview & Live Preview**: Interactive hero preview executing real aggregations against a pre-loaded ledger, plus a drag-and-drop CSV launcher.
- **High-Density Data Grid**: Sortable columns (type-aware for currency, percentages, numbers, dates, booleans, and text), live client-side search filtering, pagination, and one-click CSV export of filtered views.
- **Automated Column Profile**: Infers column types and calculates non-null counts, missing percentages, unique counts, min/median/max/mean/sum bounds, and top category frequencies.
- **Tool-Verified AI Chat**: Uses Gemini (`gemini-4-hydrogen`) with server-side function calling (`query_rows`, `aggregate_data`, `column_statistics`, `correlate_columns`) so answers are computed directly from your dataset before synthesizing insights.
- **Inline SVG Charts & Result Tables**: Generates interactive bar, line, and donut charts with hover tooltips, downloadable CSV result tables, and an expandable **Inspect calculation** trace showing the exact queries executed.
- **Saved Insights & Dual Theme**: Bookmark findings and charts to browser `localStorage` and toggle between light and dark workspace modes.
- **Built-in Sample Datasets**: Includes *SaaS Revenue & Churn Ledger*, *Global Hardware Retail Orders*, and *Renewable Grid Telemetry*.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide React, PapaParse
- **Backend**: Node.js, Express, `@google/genai`
- **Build & Tooling**: Vite 8, `tsx`

## Getting Started

### Prerequisites

- Node.js 22+
- A Gemini API key

### Environment Variables

Copy `.env.example` to `.env` and set your API key:

```env
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

### Installation & Development

```bash
npm install
npm run dev
```

The Express + Vite development server starts on `http://localhost:3000`.

### Production Build & Start

```bash
npm run build
NODE_ENV=production npm start
```

### Type Checking

```bash
npm run lint
```

## Project Structure

```text
├── server.ts                         # Express + Vite server & Gemini function-calling API (/api/datasets, /api/chat)
├── src/
│   ├── App.tsx                       # Main application shell, navigation, and workspace state
│   ├── index.css                     # Tailwind CSS v4 config and typography tokens
│   ├── shared/
│   │   ├── types.ts                  # Shared TypeScript interfaces
│   │   └── csvEngine.ts              # Deterministic CSV profiling, filtering, aggregation, and correlation engine
│   ├── data/
│   │   └── sampleDatasets.ts         # Built-in sample CSV datasets and starter question generator
│   ├── utils/
│   │   └── csvParser.ts              # PapaParse CSV/TSV parser and CSV download helpers
│   └── components/
│       ├── LandingView.tsx           # Overview landing page and feature showcase
│       ├── DataGrid.tsx              # Searchable, sortable, paginated spreadsheet table
│       ├── ColumnProfileView.tsx     # Schema audit and per-column statistics view
│       ├── ChatPanel.tsx             # Conversational analysis thread, traces, and composer
│       ├── DataChart.tsx             # Interactive SVG bar, line, and donut charts
│       ├── MarkdownRenderer.tsx      # Safe JSX Markdown and table renderer
│       ├── SavedInsightsView.tsx     # LocalStorage-backed bookmarked analyses
│       └── UploadView.tsx            # Drag-and-drop upload, raw CSV paste, and sample picker
```

## API Endpoints

- `GET /api/health` — Returns server health and active in-memory dataset count.
- `POST /api/datasets` — Registers parsed CSV headers and rows in server memory and returns `datasetId` and computed `summary`.
- `POST /api/chat` — Executes Gemini tool-calling analysis against the dataset and returns `{ datasetId, answer, charts, tables, traces, followUps }`.
