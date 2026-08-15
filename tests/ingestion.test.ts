import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  UntrustedSourceError,
  assertOfficialSourceUrl,
  chunkLegalText,
  embedTexts,
  ingestProgramSource,
  prepareSourceForStorage,
} from "@/lib/ingestion";
import { searchLegalSources, storeSourceChunks } from "@/lib/retrieval";

test("source URLs require HTTPS and an exact official host", () => {
  assert.equal(assertOfficialSourceUrl("https://www.ontario.ca/laws/statute/98e15").hostname, "www.ontario.ca");
  assert.throws(() => assertOfficialSourceUrl("http://www.ontario.ca/laws/statute/98e15"), UntrustedSourceError);
  assert.throws(() => assertOfficialSourceUrl("https://ontario.ca.attacker.example/laws/statute/98e15"), UntrustedSourceError);
  assert.throws(() => assertOfficialSourceUrl("https://www.ontario.ca.evil.example/"), UntrustedSourceError);
});

test("configured program sources are unique official HTML pages", async () => {
  const sources = JSON.parse(
    await readFile(new URL("../data/legal-sources.json", import.meta.url), "utf8"),
  ) as Array<{ id: string; programKey: string; url: string }>;
  const programKeys = new Set([
    "oesp",
    "eap",
    "leap",
    "home_renovation_savings",
    "toronto_help",
    "ontario_electricity_rebate",
    "peak_perks",
    "oeptc",
    "toronto_utility_relief",
    "toronto_basement_flooding",
  ]);
  assert.equal(new Set(sources.map(({ id }) => id)).size, sources.length);
  assert.deepEqual(new Set(sources.map(({ programKey }) => programKey)), programKeys);
  for (const source of sources) {
    assert.ok(programKeys.has(source.programKey));
    assertOfficialSourceUrl(source.url);
    assert.doesNotMatch(new URL(source.url).pathname, /\.pdf$/i);
  }
});

test("manifest includes the official OESP regulation source", async () => {
  const sources = JSON.parse(
    await readFile(new URL("../data/legal-sources.json", import.meta.url), "utf8"),
  ) as Array<{ id: string; programKey: string; authority: string; url: string }>;
  const regulation = sources.find(({ id }) => id === "ca-on-oesp-regulation-180014");
  assert.deepEqual(regulation, {
    id: "ca-on-oesp-regulation-180014",
    programKey: "oesp",
    authority: "Government of Ontario",
    jurisdiction: "CA-ON",
    title: "Ontario Electricity Support Program regulation",
    url: "https://www.ontario.ca/laws/regulation/180014",
  });
  assertOfficialSourceUrl(regulation.url);
});

test("chunking is deterministic, bounded, and overlapping", () => {
  const text = "one two three four five six seven eight nine ten eleven twelve";
  const first = chunkLegalText(text, { maxCharacters: 24, overlapCharacters: 7 });
  const second = chunkLegalText(text, { maxCharacters: 24, overlapCharacters: 7 });
  assert.deepEqual(first, second);
  assert.ok(first.length > 1);
  assert.ok(first.every((chunk) => chunk.excerpt.length <= 24));
  assert.match(first[1].excerpt, /five|four/);
  assert.ok(chunkLegalText("a".repeat(50), { maxCharacters: 24 }).every((chunk) => chunk.excerpt.length <= 24));
});

test("embedding boundaries fail before provider or database calls", async () => {
  assert.deepEqual(await embedTexts([]), []);
  await assert.rejects(embedTexts([" "]), /non-empty/);
  await assert.rejects(
    searchLegalSources(null as never, "rules", { embedding: Array(768).fill(0) }),
    /embeddingModel/,
  );
});

test("fetches and normalizes an allowlisted official source", async () => {
  let requestInit: RequestInit | undefined;
  const source = await prepareSourceForStorage(
    {
      id: "oesp",
      authority: "Ontario Energy Board",
      jurisdiction: "CA-ON",
      title: "OESP",
      url: "https://www.oeb.ca/oesp",
    },
    {
      fetchImpl: (async (_input, init) => {
        requestInit = init;
        return new Response("<h1>OESP</h1><p>Monthly credit</p>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }) as typeof fetch,
    },
  );
  assert.equal(source.text, "OESP\nMonthly credit");
  assert.match(source.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(source.chunks.length > 0);
  assert.equal(new Headers(requestInit?.headers).get("user-agent"), "curl/8.0");
});

test("ingestion stores embedded chunks as pending review", async () => {
  const query = async (strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    if (statement.includes("INSERT INTO program_versions")) return [{ id: "version-id" }];
    if (statement.includes("INSERT INTO program_sources")) return [{ id: "source-id" }];
    return [];
  };
  const database = Object.assign(query, {
    begin: async <T>(callback: (transaction: typeof query) => Promise<T>) => callback(query),
  });
  const result = await ingestProgramSource(
    database as never,
    {
      id: "oesp",
      programKey: "oesp",
      authority: "Ontario Energy Board",
      jurisdiction: "CA-ON",
      title: "OESP",
      url: "https://www.oeb.ca/oesp",
    },
    {
      fetchImpl: (async () => new Response("OESP monthly credit", {
        headers: { "content-type": "text/plain" },
      })) as typeof fetch,
      model: "test/embedding",
      embedImpl: async (texts) => texts.map(() => Array(768).fill(0)),
    },
  );
  assert.deepEqual(
    { reviewStatus: result.reviewStatus, chunks: result.chunks },
    { reviewStatus: "pending", chunks: 1 },
  );
});

test("full-text ingestion skips embeddings and stores pending chunks", async () => {
  let embeddingCalled = false;
  let sourceChunksSql = "";
  const query = async (strings: TemplateStringsArray) => {
    const statement = strings.join("?");
    if (statement.includes("INSERT INTO program_versions")) return [{ id: "version-id" }];
    if (statement.includes("INSERT INTO program_sources")) return [{ id: "source-id" }];
    sourceChunksSql = statement;
    return [];
  };
  const database = Object.assign(query, {
    begin: async <T>(callback: (transaction: typeof query) => Promise<T>) => callback(query),
  });
  const result = await ingestProgramSource(
    database as never,
    {
      id: "oesp",
      programKey: "oesp",
      authority: "Ontario Energy Board",
      jurisdiction: "CA-ON",
      title: "OESP",
      url: "https://www.oeb.ca/oesp",
    },
    {
      embed: false,
      embedImpl: async () => {
        embeddingCalled = true;
        return [];
      },
      fetchImpl: (async () => new Response("OESP monthly credit", {
        headers: { "content-type": "text/plain" },
      })) as typeof fetch,
    },
  );
  assert.equal(result.reviewStatus, "pending");
  assert.equal(embeddingCalled, false);
  assert.match(sourceChunksSql, /INSERT INTO source_chunks/);
  assert.doesNotMatch(sourceChunksSql, /embedding/);
});

test("full-text retrieval does not require pgvector", async () => {
  let sqlText = "";
  const database = (async (strings: TemplateStringsArray) => {
    sqlText = strings.join("?");
    return [];
  }) as never;
  assert.deepEqual(await searchLegalSources(database, "monthly credit"), []);
  assert.doesNotMatch(sqlText, /::vector|sc\.embedding/);
});

test("chunk batches validate before opening a transaction", async () => {
  let began = false;
  const database = Object.assign(async () => [], {
    begin: async () => {
      began = true;
    },
  });
  await assert.rejects(
    storeSourceChunks(database as never, [
      { programSourceId: "source", ordinal: 0, excerpt: "valid" },
      { programSourceId: "source", ordinal: -1, excerpt: "invalid" },
    ]),
    /non-negative ordinal/,
  );
  assert.equal(began, false);
});
