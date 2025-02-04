"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRAG = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const openai_1 = require("@langchain/openai");
const text_splitter_1 = require("langchain/text_splitter");
const uuid_1 = require("uuid");
class SupabaseRAG {
    constructor() {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not found in environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY)');
        }
        console.log('Initializing Supabase client with:', {
            url: supabaseUrl,
            keyLength: supabaseKey?.length || 0
        });
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not found in environment variables');
        }
        this.embeddings = new openai_1.OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY
        });
        this.splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 50
        });
        this.sessions = new Map();
        this.sessionId = crypto.randomUUID();
    }
    createSession() {
        const sessionId = (0, uuid_1.v4)();
        this.sessions.set(sessionId, {
            session_id: sessionId,
            created_at: new Date()
        });
        return sessionId;
    }
    async search(query) {
        try {
            const queryEmbedding = await this.embeddings.embedQuery(query);
            return this.searchDocuments(queryEmbedding);
        }
        catch (error) {
            console.error('Error in search:', error);
            throw error;
        }
    }
    async searchDocuments(queryEmbedding, matchThreshold = 0.3, matchCount = 3) {
        try {
            console.log('Searching knowledge base with:', {
                match_threshold: matchThreshold,
                match_count: matchCount,
                embedding_sample: queryEmbedding.slice(0, 3),
                embedding_length: queryEmbedding.length
            });
            // First, let's check the table structure
            const { data: tableInfo, error: tableError } = await this.supabase
                .from('knowledge_base')
                .select('*')
                .limit(1);
            console.log('Table structure:', {
                data: tableInfo,
                error: tableError,
                sample_embedding: tableInfo?.[0]?.embedding ? typeof tableInfo[0].embedding : 'no embedding'
            });
            if (tableError) {
                console.error('Error accessing knowledge base:', tableError);
                throw tableError;
            }
            // Now try the vector search
            console.log('Executing vector search with embedding:', {
                type: typeof queryEmbedding,
                length: queryEmbedding.length,
                sample: queryEmbedding.slice(0, 3)
            });
            const { data: matches, error } = await this.supabase
                .rpc('vector_search', {
                query_embedding: queryEmbedding,
                match_threshold: matchThreshold,
                match_count: matchCount
            });
            console.log('Vector search response:', {
                matches: matches?.length || 0,
                error: error?.message || null,
                first_match: matches?.[0] ? {
                    similarity: matches[0].similarity,
                    content_preview: matches[0].content?.substring(0, 50)
                } : null
            });
            if (error) {
                console.error('Error in vector search:', error);
                // Try fallback to basic search if vector search fails
                console.log('Trying fallback text search...');
                const { data: fallbackMatches, error: fallbackError } = await this.supabase
                    .from('knowledge_base')
                    .select('*')
                    .textSearch('content', queryEmbedding.join(' '))
                    .limit(matchCount);
                if (fallbackError) {
                    console.error('Fallback search error:', fallbackError);
                    throw fallbackError;
                }
                return (fallbackMatches || []).map((match) => ({
                    ...match,
                    similarity: 0.5 // Default similarity for text search matches
                }));
            }
            // Map matches to Document type and include similarity scores
            return (matches || []).map((match) => ({
                id: match.id,
                content: match.content,
                metadata: match.metadata,
                similarity: match.similarity || 0
            }));
        }
        catch (error) {
            console.error('❌ Search error:', error);
            return []; // Return empty array instead of throwing to maintain service
        }
    }
    async addDocument(content, metadata = {}) {
        try {
            // Clean up markdown content
            const cleanContent = content
                .replace(/\r\n/g, '\n')
                .replace(/```[\s\S]*?```/g, '')
                .replace(/\[.*?\]\(.*?\)/g, '')
                .trim();
            console.log('Cleaned content:', cleanContent.substring(0, 100) + '...');
            console.log('Generating embedding via OpenAI...');
            let embeddingResponse;
            try {
                embeddingResponse = await this.embeddings.embedQuery(cleanContent);
                console.log('OpenAI embedding response length:', embeddingResponse?.length);
                console.log('First few values:', embeddingResponse?.slice(0, 3));
            }
            catch (error) {
                console.error('OpenAI embedding error:', error);
                throw new Error(`Failed to generate embedding: ${error?.message || 'Unknown error'}`);
            }
            if (!embeddingResponse || !embeddingResponse.length) {
                throw new Error('Empty embedding response from OpenAI');
            }
            if (embeddingResponse.length !== 1536) {
                throw new Error(`Invalid embedding dimension: ${embeddingResponse.length} (expected 1536)`);
            }
            console.log('Inserting document into knowledge base...');
            const documentData = {
                content: cleanContent,
                metadata,
                embedding: `[${embeddingResponse.join(',')}]` // Convert array to PostgreSQL vector string format
            };
            console.log('Document data:', {
                contentPreview: cleanContent.substring(0, 50) + '...',
                metadata,
                embeddingLength: embeddingResponse.length,
                embeddingPreview: `[${embeddingResponse.slice(0, 3).join(', ')}...]`
            });
            // First check if we can access the table
            const { data: testData, error: testError } = await this.supabase
                .from('knowledge_base')
                .select('id')
                .limit(1);
            if (testError) {
                console.error('Error accessing knowledge_base table:', {
                    code: testError.code,
                    message: testError.message,
                    details: testError.details,
                    hint: testError.hint
                });
            }
            else {
                console.log('Successfully accessed knowledge_base table');
            }
            // Insert document with embedding as vector
            const { data, error } = await this.supabase
                .from('knowledge_base')
                .insert({
                content: cleanContent,
                metadata,
                embedding: embeddingResponse // Pass raw array, Supabase will convert to vector
            })
                .select('id')
                .single();
            if (error) {
                console.error('Supabase insert error:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    requestData: {
                        content: cleanContent.substring(0, 100) + '...',
                        metadata,
                        embeddingPreview: `[${embeddingResponse.slice(0, 3).join(', ')}...]`
                    }
                });
                throw error;
            }
            console.log('Successfully inserted document with ID:', data.id);
            return data.id;
        }
        catch (error) {
            console.error('Error adding document:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack?.split('\n').slice(0, 3).join('\n')
                } : error,
                context: 'Full error object:',
                fullError: JSON.stringify(error, null, 2)
            });
            throw error;
        }
    }
    async deleteDocument(id) {
        const { error } = await this.supabase
            .from('knowledge_base')
            .delete()
            .match({ id });
        if (error)
            throw error;
    }
    cleanupSessions(maxAgeHours = 24) {
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            const ageHours = (now.getTime() - session.created_at.getTime()) / (1000 * 60 * 60);
            if (ageHours > maxAgeHours) {
                this.sessions.delete(sessionId);
            }
        }
    }
    async getEmbedding(text) {
        // Use OpenAI embeddings directly
        return this.embeddings.embedQuery(text);
    }
}
exports.SupabaseRAG = SupabaseRAG;
//# sourceMappingURL=supabase-client.js.map