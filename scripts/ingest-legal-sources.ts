import { readFile } from "node:fs/promises";

import { closeDatabase, getDatabase } from "@/lib/db";
import { ingestProgramSource, type ProgramOfficialSource } from "@/lib/ingestion";

async function main() {
  const sources = JSON.parse(
    await readFile(new URL("../data/legal-sources.json", import.meta.url), "utf8"),
  ) as ProgramOfficialSource[];
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("No official sources configured");
  }

  const database = getDatabase();
  try {
    for (const source of sources) {
      const result = await ingestProgramSource(database, source);
      console.log(JSON.stringify({ sourceId: source.id, ...result }));
    }
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error("Official-source ingestion failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
