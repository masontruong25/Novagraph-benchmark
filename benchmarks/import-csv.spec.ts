import { test, expect } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildCsvFixtures } from "../fixtures/csvFixtures";

type FrameMetrics = {
  durationMs: number;
  frameCount: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
};

test.describe("CSV Import Benchmark", () => {
  test("imports CSV and records timings", async ({ page }, testInfo) => {
    const navigationStart = performance.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const navigationEnded = performance.now();

    const navigationMetrics = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType("navigation") as
        | PerformanceNavigationTiming[]
        | [];
      const firstPaint = performance
        .getEntriesByName("first-paint")
        .at(0)?.startTime;
      const firstContentfulPaint = performance
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

    // Landing page guard: click CTA if we aren't inside the app shell yet.
    const goToAppButton = page.getByRole("button", { name: /go to novagraph/i }).first();
    try {
      await goToAppButton.waitFor({ state: "visible", timeout: 5_000 });
      await goToAppButton.click();
      await page.waitForURL("**/app/**", { timeout: 30_000 });
      await page.waitForLoadState("networkidle");
    } catch {
      // Landing CTA not present, already inside the app shell.
    }

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

    const databaseName = `benchmark-${Date.now()}`;
    await dialog
      .getByPlaceholder("Enter a name for the database...")
      .fill(databaseName);

    const { nodesPayload, edgesPayload } = buildCsvFixtures();
    await dialog.locator("input#nodes-csv").setInputFiles(nodesPayload);
    await dialog.locator("input#edges-csv").setInputFiles(edgesPayload);

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
      `csv-import-${Date.now()}-${testInfo.project.name}.json`
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
});
