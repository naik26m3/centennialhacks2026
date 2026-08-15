import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { closeDatabase, getDatabase } from "@/lib/db";
import { ingestProgramSource, type ProgramOfficialSource } from "@/lib/ingestion";

export type IngestionOutcome =
  | ({ sourceId: string; status: "ok" } & Awaited<ReturnType<typeof ingestProgramSource>>)
  | { sourceId: string; status: "failed"; errorName: string };

export function embeddingEnabled(args: readonly string[] = process.argv.slice(2)): boolean {
  return args.includes("--embed");
}

export async function ingestSources(
  database: Parameters<typeof ingestProgramSource>[0],
  sources: readonly ProgramOfficialSource[],
  ingest: typeof ingestProgramSource = (database, source) => ingestProgramSource(database, source, { embed: false }),
  options: { embed?: boolean } = {},
): Promise<IngestionOutcome[]> {
  const outcomes: IngestionOutcome[] = [];
  for (const source of sources) {
    try {
      outcomes.push({
        sourceId: source.id,
        status: "ok",
        ...(await ingest(database, source, { embed: options.embed === true })),
      });
    } catch (error) {
      outcomes.push({
        sourceId: source.id,
        status: "failed",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  return outcomes;
}

export async function main() {
  const sources = JSON.parse(
    await readFile(new URL("../data/legal-sources.json", import.meta.url), "utf8"),
  ) as ProgramOfficialSource[];
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("No official sources configured");
  }

  const database = getDatabase();
  try {
    const outcomes = await ingestSources(database, sources, undefined, { embed: embeddingEnabled() });
    for (const outcome of outcomes) {
      console.log(JSON.stringify(outcome));
    }
    const failures = outcomes.filter((outcome) => outcome.status === "failed").length;
    if (failures > 0) {
      throw new Error(`Official-source ingestion failed for ${failures}/${outcomes.length} source(s)`);
    }
  } finally {
    await closeDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Official-source ingestion failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  });
}
