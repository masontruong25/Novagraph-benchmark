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
# Plain run
npm run bench

# Show the UI runner while developing the script
npm run bench:ui

# Pass additional Playwright CLI flags
npm run bench -- --repeat-each=3 --headed
```

The `bench` script targets the deployed NovaGraph app via the base URL configured in `playwright.config.ts`. During a run it will:
1. Navigate to the renderer surface.
2. Open the "Create Graph" flow and choose the CSV import option defined in `src/features/visualizer/import/implementations/csv.tsx` of NovaGraph-v2.
3. Upload generated fixture files and submit the form.
4. Await the new database being selected, signalling that the import finished.
5. Capture navigation timings (`performance.getEntriesByType("navigation")`), client-side import duration, and approximate FPS stats gathered with `requestAnimationFrame` while the import executes.

## Outputs
- Console summary table (import ms plus FPS stats)
- Structured JSON report saved to `results/` (e.g. `results/csv-import-<timestamp>-chromium.json`)
- Playwright attachments available under `test-results/`

Add the `results/`, `test-results/`, and `playwright-report/` directories to `.gitignore` (already done) to avoid checking large artifacts into source control.

## Extending
- Add more fixtures in `fixtures/csvFixtures.ts` or parameterize its helper to stress-test larger graphs.
- Create additional specs under `benchmarks/` (e.g., graph editing, query execution) and reference them from package scripts.
- Adjust metrics collection (e.g., use the Chrome tracing API) if you need deeper profiling data.
