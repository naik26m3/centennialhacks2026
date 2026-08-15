import { EMBEDDING_DIMENSIONS } from "@/lib/ai/openrouter";
import type { Database } from "@/lib/db";

export const EMBEDDING_DIMENSION = EMBEDDING_DIMENSIONS;

export type StoredSourceChunk = {
  programSourceId: string;
  ordinal: number;
  title?: string;
  excerpt: string;
  metadata?: Record<string, unknown>;
  embedding?: readonly number[];
  embeddingModel?: string;
};

export type RetrievalResult = {
  id: string;
  ordinal: number;
  title: string | null;
  excerpt: string;
  metadata: Record<string, unknown>;
  source: {
    id: string;
    authority: string;
    url: string;
    programVersionId: string;
    reviewStatus: string;
  };
  textScore: number;
  vectorScore: number;
  score: number;
};

type QueryDatabase = {
  (strings: TemplateStringsArray, ...parameters: unknown[]): Promise<Array<Record<string, unknown>>>;
};

type TransactionDatabase = QueryDatabase & {
  begin?: <T>(callback: (query: QueryDatabase) => Promise<T>) => Promise<T>;
};

function vectorLiteral(values: readonly number[]): string {
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new RangeError(`Embedding must have ${EMBEDDING_DIMENSION} dimensions`);
  }
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError("Embedding values must be finite numbers");
  return `[${values.join(",")}]`;
}

export async function storeSourceChunks(database: Database, chunks: readonly StoredSourceChunk[]): Promise<void> {
  const prepared = chunks.map((chunk) => {
    if (!chunk.programSourceId || !Number.isInteger(chunk.ordinal) || chunk.ordinal < 0 || !chunk.excerpt.trim()) {
      throw new TypeError("Source chunks require a source ID, non-negative ordinal, and excerpt");
    }
    const embedding = chunk.embedding ? vectorLiteral(chunk.embedding) : null;
    if (embedding && !chunk.embeddingModel?.trim()) throw new TypeError("Embedded chunks require embeddingModel");
    return { chunk, embedding };
  });

  const write = async (query: QueryDatabase) => {
    for (const { chunk, embedding } of prepared) {
      if (!embedding) {
        await query`
          INSERT INTO source_chunks (program_source_id, ordinal, title, excerpt, metadata)
          VALUES (${chunk.programSourceId}::uuid, ${chunk.ordinal}, ${chunk.title ?? null},
                  ${chunk.excerpt}, ${chunk.metadata ?? {}})
          ON CONFLICT (program_source_id, ordinal) DO UPDATE SET
            title = EXCLUDED.title,
            excerpt = EXCLUDED.excerpt,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        `;
        continue;
      }
      await query`
        INSERT INTO source_chunks
          (program_source_id, ordinal, title, excerpt, metadata, embedding, embedding_model, embedding_dimensions)
        VALUES
          (${chunk.programSourceId}::uuid, ${chunk.ordinal}, ${chunk.title ?? null}, ${chunk.excerpt},
           ${chunk.metadata ?? {}}, ${embedding}::vector, ${chunk.embeddingModel}, ${EMBEDDING_DIMENSION})
        ON CONFLICT (program_source_id, ordinal) DO UPDATE SET
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          embedding_model = EXCLUDED.embedding_model,
          embedding_dimensions = EXCLUDED.embedding_dimensions,
          updated_at = now()
      `;
    }
  };

  const client = database as unknown as TransactionDatabase;
  if (client.begin) await client.begin(write);
  else await write(client);
}

export type SearchOptions = {
  embedding?: readonly number[];
  embeddingModel?: string;
  limit?: number;
  jurisdiction?: string;
  programVersionId?: string;
  asOf?: string;
  includeUnreviewed?: boolean;
};

/** Hybrid retrieval: reviewed-source full text always participates; vectors add semantic recall when supplied. */
export async function searchLegalSources(
  database: Database,
  query: string,
  options: SearchOptions = {},
): Promise<RetrievalResult[]> {
  if (!query.trim()) throw new TypeError("Retrieval query must be non-empty");
  const limit = options.limit ?? 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("limit must be between 1 and 50");
  const embedding = options.embedding ? vectorLiteral(options.embedding) : null;
  const embeddingModel = embedding ? options.embeddingModel?.trim() : null;
  if (embedding && !embeddingModel) throw new TypeError("Vector retrieval requires embeddingModel");
  const jurisdiction = options.jurisdiction ?? null;
  const programVersionId = options.programVersionId ?? null;
  const asOf = options.asOf ?? null;
  const queryDatabase = database as unknown as QueryDatabase;
  const rows = embedding
    ? await queryDatabase`
    WITH ranked AS (
      SELECT
        sc.id::text AS id,
        sc.ordinal,
        sc.title,
        sc.excerpt,
        sc.metadata,
        ps.id::text AS source_id,
        ps.authority,
        ps.source_url,
        ps.program_version_id::text AS program_version_id,
        ps.review_status::text AS review_status,
        ts_rank_cd(
          to_tsvector('simple', coalesce(sc.title, '') || ' ' || sc.excerpt),
          plainto_tsquery('simple', ${query})
        ) AS text_score,
        CASE
          WHEN ${embedding}::vector IS NULL OR sc.embedding IS NULL OR sc.embedding_model <> ${embeddingModel} THEN 0
          ELSE greatest(0, 1 - (sc.embedding <=> ${embedding}::vector))
        END AS vector_score
      FROM source_chunks sc
      JOIN program_sources ps ON ps.id = sc.program_source_id
      WHERE (${options.includeUnreviewed === true} OR ps.review_status = 'reviewed')
        AND (${programVersionId}::uuid IS NULL OR ps.program_version_id = ${programVersionId}::uuid)
        AND (${jurisdiction} IS NULL OR sc.metadata ->> 'jurisdiction' = ${jurisdiction})
        AND (${asOf}::date IS NULL OR (ps.effective_start IS NULL OR ps.effective_start <= ${asOf}::date))
        AND (${asOf}::date IS NULL OR (ps.effective_end IS NULL OR ps.effective_end >= ${asOf}::date))
        AND (
          to_tsvector('simple', coalesce(sc.title, '') || ' ' || sc.excerpt)
            @@ plainto_tsquery('simple', ${query})
          OR (${embedding}::vector IS NOT NULL AND sc.embedding IS NOT NULL AND sc.embedding_model = ${embeddingModel})
        )
    )
    SELECT *, (0.55 * text_score + 0.45 * vector_score) AS score
    FROM ranked
    ORDER BY score DESC, id ASC
    LIMIT ${limit}
  `
    : await queryDatabase`
    WITH ranked AS (
      SELECT
        sc.id::text AS id,
        sc.ordinal,
        sc.title,
        sc.excerpt,
        sc.metadata,
        ps.id::text AS source_id,
        ps.authority,
        ps.source_url,
        ps.program_version_id::text AS program_version_id,
        ps.review_status::text AS review_status,
        ts_rank_cd(
          to_tsvector('simple', coalesce(sc.title, '') || ' ' || sc.excerpt),
          plainto_tsquery('simple', ${query})
        ) AS text_score,
        0::double precision AS vector_score
      FROM source_chunks sc
      JOIN program_sources ps ON ps.id = sc.program_source_id
      WHERE (${options.includeUnreviewed === true} OR ps.review_status = 'reviewed')
        AND (${programVersionId}::uuid IS NULL OR ps.program_version_id = ${programVersionId}::uuid)
        AND (${jurisdiction} IS NULL OR sc.metadata ->> 'jurisdiction' = ${jurisdiction})
        AND (${asOf}::date IS NULL OR (ps.effective_start IS NULL OR ps.effective_start <= ${asOf}::date))
        AND (${asOf}::date IS NULL OR (ps.effective_end IS NULL OR ps.effective_end >= ${asOf}::date))
        AND to_tsvector('simple', coalesce(sc.title, '') || ' ' || sc.excerpt)
          @@ plainto_tsquery('simple', ${query})
    )
    SELECT *, text_score AS score
    FROM ranked
    ORDER BY score DESC, id ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: String(row.id),
    ordinal: Number(row.ordinal),
    title: row.title == null ? null : String(row.title),
    excerpt: String(row.excerpt),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    source: {
      id: String(row.source_id),
      authority: String(row.authority),
      url: String(row.source_url),
      programVersionId: String(row.program_version_id),
      reviewStatus: String(row.review_status),
    },
    textScore: Number(row.text_score),
    vectorScore: Number(row.vector_score),
    score: Number(row.score),
  }));
}
