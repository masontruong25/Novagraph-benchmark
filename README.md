# NovaGraph Benchmarks

Automated Playwright benchmarks that exercise the NovaGraph CSV importer deployed at https://novagraph-test.up.railway.app/app. Each run loads the production UI, uploads generated `nodes.csv` / `edges.csv` fixtures, and records import timings plus a simple frame-rate sample around the import.

## Prerequisites
- Node.js 18+
- npm (comes with Node.js)
- Chromium dependencies (Playwright will prompt if something is missing)

## Setup
```bash
npm install
npm run playwright-install
```

## Running the CSV import benchmark
```bash
# Plain multi-dataset run (automatically iterates over data/import/csv)
npm run bench

# Show the UI runner while developing the script
npm run bench:ui

# Pass additional Playwright CLI flags
npm run bench -- --repeat-each=3 --headed
```

The `bench` script targets the deployed NovaGraph app via the base URL configured in `playwright.config.ts`. Each run scans `data/import/csv/**`, finds every folder that contains both `nodes*.csv` and `edges*.csv`, and executes the CSV importer workflow for each dataset sequentially. If the directory is empty it falls back to the generated sample fixtures from `fixtures/csvFixtures.ts`.

During every dataset run the script will:
1. Navigate to the renderer surface (clicking the landing-page CTA if necessary).
2. Open the "Create Graph" flow and choose the CSV import option defined in `NovaGraph-v2/src/features/visualizer/import/implementations/csv.tsx`.
3. Upload the dataset-specific CSV files (or generated fallbacks) and submit the form.
4. Await the new database being selected, signalling that the import finished.
5. Capture navigation timings (`performance.getEntriesByType("navigation")`), client-side import duration, and approximate FPS stats gathered with `requestAnimationFrame` while the import executes.

> **Note:** Set `CSV_DATA_ROOT=/custom/path` to point the benchmark at a different on-disk dataset tree. All Playwright action/navigation timeouts are disabled in `playwright.config.ts`, and the per-test timeout is raised to 10 minutes to accommodate the larger samples.

## Outputs
- Console summary table (import ms plus FPS stats)
- Structured JSON report saved to `results/` (e.g. `results/csv-import-<timestamp>-chromium.json`)
- Playwright attachments available under `test-results/`

Add the `results/`, `test-results/`, and `playwright-report/` directories to `.gitignore` (already done) to avoid checking large artifacts into source control.

## Extending
- Add more fixtures in `fixtures/csvFixtures.ts` or parameterize its helper to stress-test larger graphs.
- Create additional specs under `benchmarks/` (e.g., graph editing, query execution) and reference them from package scripts.
- Adjust metrics collection (e.g., use the Chrome tracing API) if you need deeper profiling data.
