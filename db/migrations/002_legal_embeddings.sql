-- pgvector must be enabled by the database administrator before this migration.
-- This migration intentionally does not create extensions or change migration 001.

ALTER TABLE source_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimensions integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'source_chunks'::regclass
      AND conname = 'source_chunks_embedding_dimensions_check'
  ) THEN
    ALTER TABLE source_chunks
      ADD CONSTRAINT source_chunks_embedding_dimensions_check
      CHECK (embedding_dimensions IS NULL OR embedding_dimensions = 768);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS source_chunks_embedding_hnsw_idx
  ON source_chunks USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
