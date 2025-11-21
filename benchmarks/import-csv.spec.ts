import { test, expect } from "@playwright/test";
import { performance } from "perf_hooks";
import { promises as fs } from "fs";
import path from "path";

import { buildCsvFixtures } from "../fixtures/csvFixtures";
import {
  discoverCsvDatasets,
  type CsvDataset,
} from "./utils/csvDatasets";

type FrameMetrics = {
  durationMs: number;
  frameCount: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
};

type DatasetRun =
  | { type: "file"; dataset: CsvDataset }
  | { type: "generated"; label: string };

const csvDatasets = await discoverCsvDatasets();
const datasetRuns: DatasetRun[] =
  csvDatasets.length > 0
    ? csvDatasets.map((dataset) => ({ type: "file", dataset }))
    : [{ type: "generated", label: "generated" }];

test.describe("CSV Import Benchmark", () => {
  for (const run of datasetRuns) {
    const label = run.type === "file" ? run.dataset.label : run.label;

    test(`imports CSV dataset "${label}"`, async ({ page }, testInfo) => {
    const navigationStart = performance.now();
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const navigationEnded = performance.now();

    const navigationMetrics = await page.evaluate(() => {
      type NavEntry = {
        domContentLoadedEventEnd: number;
        loadEventEnd: number;
        startTime: number;
        responseEnd: number;
        requestStart: number;
      };
      type PaintEntry = { startTime: number };
      const perf = performance as unknown as {
        getEntriesByType(type: string): NavEntry[];
        getEntriesByName(name: string): PaintEntry[];
      };
      const [nav] = perf.getEntriesByType("navigation") ?? [];
      const firstPaint = perf.getEntriesByName("first-paint").at(0)?.startTime;
      const firstContentfulPaint = perf
        .getEntriesByName("first-contentful-paint")
        .at(0)?.startTime;
      return nav
        ? {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
            loadEvent: nav.loadEventEnd - nav.startTime,
            responseTime: nav.responseEnd - nav.requestStart,
            firstPaint: firstPaint ?? null,
            firstContentfulPaint: firstContentfulPaint ?? null,
          }
        : null;
    });

    // Open import dialog through the database dropdown
    const databaseContainer = page.locator('span:has-text("Database")').first();
    await databaseContainer.waitFor({ state: "visible", timeout: 20_000 });
    const databaseButton = databaseContainer.locator("xpath=..").locator("button").first();
    await databaseButton.waitFor({ state: "visible", timeout: 20_000 });
    await databaseButton.scrollIntoViewIfNeeded();
    await databaseButton.click();
    await page.getByRole("option", { name: /create graph/i }).click();

    const dialog = page.getByRole("dialog", { name: /Import File/i });
    await dialog.waitFor();

    const databaseName = `benchmark-${label}-${Date.now()}`;
    await dialog
      .getByPlaceholder("Enter a name for the database...")
      .fill(databaseName);

    if (run.type === "file") {
      await dialog.locator("input#nodes-csv").setInputFiles(run.dataset.nodesPath);
      await dialog.locator("input#edges-csv").setInputFiles(run.dataset.edgesPath);
    } else {
      const { nodesPayload, edgesPayload } = buildCsvFixtures();
      await dialog.locator("input#nodes-csv").setInputFiles(nodesPayload);
      await dialog.locator("input#edges-csv").setInputFiles(edgesPayload);
    }

    const fpsRecorder = page.evaluate(() => {
      return new Promise<FrameMetrics>((resolve) => {
        const samples: number[] = [];
        let running = true;
        const start = performance.now();
        let last = start;

        const stop = () => {
          if (!running) return;
          running = false;
          const durationMs = performance.now() - start;
          const fpsSeries = samples
            .filter((delta) => delta > 0)
            .map((delta) => 1000 / delta);
          const frameCount = fpsSeries.length;
          const averageFps =
            frameCount > 0
              ? fpsSeries.reduce((acc, value) => acc + value, 0) / frameCount
              : 0;
          const minFps = frameCount > 0 ? Math.min(...fpsSeries) : 0;
          const maxFps = frameCount > 0 ? Math.max(...fpsSeries) : 0;
          resolve({ durationMs, frameCount, averageFps, minFps, maxFps });
        };

        function loop(time: number) {
          if (!running) return;
          samples.push(time - last);
          last = time;
          requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);
        window.addEventListener(
          "novagraph-benchmark-stop",
          () => stop(),
          { once: true }
        );
      });
    });

    const importStart = performance.now();
    await dialog.getByRole("button", { name: "Create Graph" }).click();

    await expect(databaseButton).toHaveText(
      new RegExp(databaseName, "i"),
      {
        timeout: 45_000,
      }
    );

    await page.evaluate(() => {
      window.dispatchEvent(new Event("novagraph-benchmark-stop"));
    });

    const frameMetrics = await fpsRecorder;
    const importDuration = performance.now() - importStart;

    const report = {
      target: "https://novagraph-test.up.railway.app/app",
      datasetLabel: label,
      datasetType: run.type,
      datasetFiles:
        run.type === "file"
          ? {
              nodesPath: run.dataset.nodesPath,
              edgesPath: run.dataset.edgesPath,
            }
          : null,
      databaseName,
      timestamps: {
        navigationStart,
        navigationEnd: navigationEnded,
      },
      navigationMetrics,
      importDurationMs: importDuration,
      frameMetrics,
    };

    const resultsDir = path.join(testInfo.project.outputDir, "..", "..", "results");
    await fs.mkdir(resultsDir, { recursive: true });
    const filePath = path.join(
      resultsDir,
      `csv-import-${label}-${Date.now()}-${testInfo.project.name}.json`
    );
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");

    console.table({
      navigation_ms: navigationEnded - navigationStart,
      import_ms: importDuration,
      fps_avg: frameMetrics.averageFps.toFixed(2),
      fps_min: frameMetrics.minFps.toFixed(2),
      fps_max: frameMetrics.maxFps.toFixed(2),
    });

    await testInfo.attach("csv-import-benchmark", {
      contentType: "application/json",
      body: JSON.stringify(report, null, 2),
    });

    expect(report.importDurationMs).toBeGreaterThan(0);
    });
  }
});
