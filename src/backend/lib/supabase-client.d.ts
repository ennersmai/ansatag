import { SupabaseClient } from '@supabase/supabase-js';
export interface Document {
    id: string;
    content: string;
    metadata: Record<string, any>;
    similarity?: number;
}
export declare class SupabaseRAG {
    supabase: SupabaseClient;
    private embeddings;
    private splitter;
    private sessions;
    sessionId: string;
    constructor();
    createSession(): string;
    search(query: string): Promise<Document[]>;
    searchDocuments(queryEmbedding: number[], matchThreshold?: number, matchCount?: number): Promise<Document[]>;
    addDocument(content: string, metadata?: any): Promise<string>;
    deleteDocument(id: string): Promise<void>;
    cleanupSessions(maxAgeHours?: number): void;
    getEmbedding(text: string): Promise<number[]>;
}
