import { promises as fs } from "fs";
import path from "path";

export type CsvDataset = {
  label: string;
  nodesPath: string;
  edgesPath: string;
};

const DEFAULT_DATA_ROOT = path.resolve(
  process.cwd(),
  "data",
  "import",
  "csv"
);

export async function discoverCsvDatasets(
  dataRoot: string = process.env.CSV_DATA_ROOT ?? DEFAULT_DATA_ROOT
): Promise<CsvDataset[]> {
  try {
    const dirents = await fs.readdir(dataRoot, { withFileTypes: true });
    const datasets: CsvDataset[] = [];

    for (const entry of dirents) {
      if (!entry.isDirectory()) continue;
      const folderPath = path.join(dataRoot, entry.name);
      const contents = await fs.readdir(folderPath);

      const nodesFile = findCsvFile(contents, "nodes");
      const edgesFile = findCsvFile(contents, "edges");

      if (!nodesFile || !edgesFile) continue;

      datasets.push({
        label: entry.name,
        nodesPath: path.join(folderPath, nodesFile),
        edgesPath: path.join(folderPath, edgesFile),
      });
    }

    return datasets.sort((a, b) => collator.compare(a.label, b.label));
  } catch (err) {
    console.warn(
      `[discoverCsvDatasets] Unable to read data root "${dataRoot}":`,
      err
    );
    return [];
  }
}

function findCsvFile(files: string[], prefix: string) {
  return files.find((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith(".csv") && lower.includes(prefix.toLowerCase());
  });
}

const collator = new Intl.Collator(undefined, { numeric: true });

