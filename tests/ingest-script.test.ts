import assert from "node:assert/strict";
import test from "node:test";
import { embeddingEnabled, ingestSources } from "@/scripts/ingest-legal-sources";

const source = (id: string) => ({
  id,
  programKey: "oesp",
  authority: "Ontario Energy Board",
  jurisdiction: "CA-ON" as const,
  title: id,
  url: "https://oeb.ca/oesp",
});

test("ingestion reports a failed source and continues with later sources", async () => {
  const outcomes = await ingestSources(null as never, [source("first"), source("second")], async (_database, item) => {
    if (item.id === "first") throw new Error("source unavailable");
    return {
      programVersionId: "version-id",
      programSourceId: "source-id",
      reviewStatus: "pending" as const,
      chunks: 1,
      contentHash: "hash",
    };
  });

  assert.deepEqual(outcomes.map(({ sourceId, status }) => ({ sourceId, status })), [
    { sourceId: "first", status: "failed" },
    { sourceId: "second", status: "ok" },
  ]);
  assert.equal(outcomes[0]?.status === "failed" && outcomes[0].errorName, "Error");
});

test("ingestion defaults to full-text and enables embeddings with --embed", async () => {
  const modes: boolean[] = [];
  const ingest: Parameters<typeof ingestSources>[2] = async (_database, item, options) => {
    modes.push(options?.embed === true);
    return {
      programVersionId: `${item.id}-version`,
      programSourceId: `${item.id}-source`,
      reviewStatus: "pending" as const,
      chunks: 1,
      contentHash: "hash",
    };
  };

  await ingestSources(null as never, [source("default")], ingest);
  assert.deepEqual(modes, [false]);

  modes.length = 0;
  await ingestSources(null as never, [source("embedded")], ingest, {
    embed: embeddingEnabled(["--embed"]),
  });
  assert.deepEqual(modes, [true]);
  assert.equal(embeddingEnabled([]), false);
});
