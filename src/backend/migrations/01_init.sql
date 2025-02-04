-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create the vector similarity search index
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create the vector similarity search function
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
) RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity float
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        knowledge_base.id,
        knowledge_base.content,
        knowledge_base.metadata,
        1 - (knowledge_base.embedding <=> query_embedding) as similarity
    FROM knowledge_base
    WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$; 