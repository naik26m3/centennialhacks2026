import { createHash } from "node:crypto";
import { embedMany } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  getEmbeddingDimensions,
  getOpenRouterEmbeddingModel,
  getOpenRouter,
} from "@/lib/ai/openrouter";
import type { Database } from "@/lib/db";
import { storeSourceChunks } from "@/lib/retrieval";

export const OFFICIAL_HOSTS = [
  "laws-lois.justice.gc.ca",
  "ontario.ca",
  "www.ontario.ca",
  "oeb.ca",
  "www.oeb.ca",
  "saveonenergy.ca",
  "www.saveonenergy.ca",
  "homerenovationsavings.ca",
  "www.homerenovationsavings.ca",
  "toronto.ca",
  "www.toronto.ca",
] as const;

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;

export type OfficialSource = {
  id: string;
  authority: string;
  jurisdiction: "CA" | "CA-ON";
  title: string;
  url: string;
};

export type ProgramOfficialSource = OfficialSource & { programKey: string };

export type SourceChunk = {
  ordinal: number;
  excerpt: string;
  title?: string;
};

export type FetchedSource = OfficialSource & {
  retrievedAt: string;
  contentHash: string;
  text: string;
  chunks: SourceChunk[];
};

export class UntrustedSourceError extends Error {
  override name = "UntrustedSourceError";
}

/** Validate before any network request; host matching is exact, never suffix based. */
export function assertOfficialSourceUrl(
  value: string,
  hosts: readonly string[] = OFFICIAL_HOSTS,
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UntrustedSourceError("Source URL is not valid");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname as (typeof OFFICIAL_HOSTS)[number])
  ) {
    throw new UntrustedSourceError("Source URL is not on the official HTTPS allowlist");
  }
  return url;
}

function stripMarkup(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function normalizeLegalText(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Source text must be a non-empty string");
  }
  return stripMarkup(value);
}

/** Deterministic word-boundary chunks. Overlap is measured in whole words. */
export function chunkLegalText(
  value: string,
  options: { maxCharacters?: number; overlapCharacters?: number } = {},
): SourceChunk[] {
  const maxCharacters = options.maxCharacters ?? 1_800;
  const overlapCharacters = options.overlapCharacters ?? Math.min(200, Math.floor(maxCharacters / 4));
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new RangeError("maxCharacters must be a positive integer");
  }
  if (!Number.isInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
    throw new RangeError("overlapCharacters must be between 0 and maxCharacters");
  }

  const words = normalizeLegalText(value).split(/\s+/).flatMap((word) => {
    if (word.length <= maxCharacters) return [word];
    const pieces: string[] = [];
    for (let offset = 0; offset < word.length; offset += maxCharacters) {
      pieces.push(word.slice(offset, offset + maxCharacters));
    }
    return pieces;
  });
  const chunks: SourceChunk[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let length = 0;
    while (end < words.length) {
      const nextLength = length === 0 ? words[end].length : length + 1 + words[end].length;
      if (nextLength > maxCharacters && end > start) break;
      length = nextLength;
      end += 1;
    }
    const excerpt = words.slice(start, end).join(" ").trim();
    if (excerpt) chunks.push({ ordinal: chunks.length, excerpt });
    if (end >= words.length) break;

    let overlapWords = 0;
    let overlapLength = 0;
    for (let index = end - 1; index >= start; index -= 1) {
      const nextLength = overlapLength === 0 ? words[index].length : overlapLength + 1 + words[index].length;
      if (nextLength > overlapCharacters) break;
      overlapLength = nextLength;
      overlapWords += 1;
    }
    start = Math.max(start + 1, end - overlapWords);
  }
  return chunks;
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SOURCE_BYTES) throw new UntrustedSourceError("Source response is too large");
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) {
      throw new UntrustedSourceError("Source response is too large");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new UntrustedSourceError("Source response is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function fetchOfficialSource(
  source: OfficialSource,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<FetchedSource> {
  const url = assertOfficialSourceUrl(source.url);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { accept: "text/html,text/plain", "user-agent": "curl/8.0" },
    });
    assertOfficialSourceUrl(response.url || url.toString());
    if (!response.ok) throw new UntrustedSourceError(`Official source returned HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/^(text\/html|text\/plain)(?:;|$)/i.test(contentType)) {
      throw new UntrustedSourceError("Official source is not text or HTML");
    }
    const text = normalizeLegalText(await readBoundedText(response));
    const retrievedAt = new Date().toISOString();
    return {
      ...source,
      retrievedAt,
      contentHash: createHash("sha256").update(text, "utf8").digest("hex"),
      text,
      chunks: chunkLegalText(text),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function embedTexts(
  texts: readonly string[],
  options: {
    model?: string;
    dimensions?: number;
    inputType?: "search_document" | "search_query";
  } = {},
): Promise<number[][]> {
  if (texts.some((text) => typeof text !== "string" || !text.trim())) {
    throw new TypeError("Every embedding input must be non-empty text");
  }
  if (texts.length === 0) return [];
  const model = options.model ?? getOpenRouterEmbeddingModel();
  const dimensions = options.dimensions ?? getEmbeddingDimensions();
  if (!model.trim()) throw new TypeError("Embedding model must be non-empty");
  if (dimensions !== EMBEDDING_DIMENSIONS) {
    throw new RangeError(`Embedding dimensions must be ${EMBEDDING_DIMENSIONS} for the current database schema`);
  }

  const openrouter = getOpenRouter();
  const { embeddings } = await embedMany({
    model: openrouter.textEmbeddingModel(model, {
      extraBody: {
        dimensions,
        input_type: options.inputType ?? "search_document",
      },
    }),
    values: [...texts],
  });
  if (embeddings.length !== texts.length || embeddings.some((embedding) => embedding.length !== dimensions)) {
    throw new Error("Embedding provider returned an unexpected number of dimensions");
  }
  return embeddings;
}

export async function prepareSourceForStorage(
  source: OfficialSource,
  options: Parameters<typeof fetchOfficialSource>[1] & {
    chunk?: { maxCharacters?: number; overlapCharacters?: number };
  } = {},
): Promise<FetchedSource> {
  const fetched = await fetchOfficialSource(source, options);
  return { ...fetched, chunks: chunkLegalText(fetched.text, options.chunk) };
}

type IngestionDatabase = {
  (strings: TemplateStringsArray, ...parameters: unknown[]): Promise<Array<Record<string, unknown>>>;
};

export async function ingestProgramSource(
  database: Database,
  source: ProgramOfficialSource,
  options: {
    fetchImpl?: typeof fetch;
    embedImpl?: typeof embedTexts;
    embed?: boolean;
    model?: string;
  } = {},
) {
  if (!/^[a-z][a-z0-9_]*$/.test(source.programKey)) {
    throw new TypeError("programKey must be a canonical program key");
  }
  const fetched = await prepareSourceForStorage(source, { fetchImpl: options.fetchImpl });
  const model = options.embed === false ? undefined : options.model ?? getOpenRouterEmbeddingModel();
  const embeddings = options.embed === false
    ? undefined
    : await (options.embedImpl ?? embedTexts)(
        fetched.chunks.map((chunk) => chunk.excerpt),
        { model, inputType: "search_document" },
      );
  const query = database as unknown as IngestionDatabase;
  const versionKey = `snapshot_${fetched.contentHash.slice(0, 16)}`;
  const versions = await query`
    INSERT INTO program_versions (program_id, version_key, status)
    SELECT id, ${versionKey}, 'draft'
    FROM programs
    WHERE canonical_key = ${source.programKey}
    ON CONFLICT (program_id, version_key) DO UPDATE SET updated_at = now()
    RETURNING id::text AS id
  `;
  const programVersionId = String(versions[0]?.id ?? "");
  if (!programVersionId) throw new Error(`Unknown program key: ${source.programKey}`);

  const sources = await query`
    INSERT INTO program_sources
      (program_version_id, authority, source_url, retrieved_at, content_hash, review_status)
    VALUES
      (${programVersionId}::uuid, ${source.authority}, ${source.url}, ${fetched.retrievedAt},
       ${fetched.contentHash}, 'pending')
    ON CONFLICT (program_version_id, source_url, content_hash) DO UPDATE
      SET retrieved_at = EXCLUDED.retrieved_at,
          updated_at = now()
    RETURNING id::text AS id
  `;
  const programSourceId = String(sources[0]?.id ?? "");
  if (!programSourceId) throw new Error("Program source could not be stored");

  await storeSourceChunks(
    database,
    fetched.chunks.map((chunk, index) => ({
      programSourceId,
      ordinal: chunk.ordinal,
      title: source.title,
      excerpt: chunk.excerpt,
      metadata: {
        sourceId: source.id,
        jurisdiction: source.jurisdiction,
        retrievedAt: fetched.retrievedAt,
        contentHash: fetched.contentHash,
      },
      embedding: embeddings?.[index],
      embeddingModel: embeddings ? model : undefined,
    })),
  );

  return {
    programVersionId,
    programSourceId,
    reviewStatus: "pending" as const,
    chunks: fetched.chunks.length,
    contentHash: fetched.contentHash,
  };
}
