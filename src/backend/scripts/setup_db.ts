import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

async function setupDatabase() {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found in environment variables');
    }

    console.log('Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if table exists
    console.log('Checking if knowledge_base table exists...');
    const { data: tableExists, error: tableError } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1);

    if (tableError) {
      if (tableError.code === '42P01') { // Table does not exist
        console.log('Table does not exist, please run the following SQL in the Supabase dashboard:');
        console.log(`
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the knowledge_base table
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),  -- OpenAI embeddings are 1536 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create a function to search for similar documents
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
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
    ORDER BY knowledge_base.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;`);
        process.exit(1);
      }
      throw tableError;
    }

    console.log('✅ Database is ready to use');
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

setupDatabase(); 