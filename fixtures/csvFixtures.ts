export type CsvPayload = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

export type CsvFixtureOptions = {
  nodes?: number;
};

const NODE_HEADER = "node";
const EDGE_HEADER = "source,target,weight";

export function buildCsvFixtures(options: CsvFixtureOptions = {}) {
  const nodeCount = Math.max(4, options.nodes ?? 12);
  const nodeRows: string[] = [NODE_HEADER];
  const edgeRows: string[] = [EDGE_HEADER];

  for (let i = 0; i < nodeCount; i += 1) {
    nodeRows.push(`Person-${i}`);
    if (i > 0) {
      const weight = ((i % 3) + 1).toString();
      edgeRows.push(`Person-${i - 1},Person-${i},${weight}`);
    }
  }

  const nodesPayload: CsvPayload = {
    name: "nodes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(nodeRows.join("\n"), "utf-8"),
  };

  const edgesPayload: CsvPayload = {
    name: "edges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(edgeRows.join("\n"), "utf-8"),
  };

  return { nodesPayload, edgesPayload };
}
