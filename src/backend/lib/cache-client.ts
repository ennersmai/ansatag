import { Redis } from 'ioredis';
import { AgentResponse } from '../agent/orchestrator';
import { SupabaseRAG } from './supabase-client';

interface CacheEntry {
  response: AgentResponse;
  timestamp: number;
  embedding?: number[];
}

export class CacheClient {
  private redis: Redis;
  private rag: SupabaseRAG;
  
  // Cache configuration
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly SIMILARITY_THRESHOLD = 0.85;
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.rag = new SupabaseRAG();
  }

  private async getEmbedding(text: string): Promise<number[]> {
    return this.rag.getEmbedding(text);
  }

  private calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  async get(input: string): Promise<AgentResponse | null> {
    try {
      // Get embedding for input
      const inputEmbedding = await this.getEmbedding(input);
      
      // Get all cache entries
      const cacheKeys = await this.redis.keys('cache:*');
      let bestMatch: { key: string; similarity: number } | null = null;
      
      for (const key of cacheKeys) {
        const entry: CacheEntry = JSON.parse(await this.redis.get(key) || '{}');
        
        // Check TTL
        if (Date.now() - entry.timestamp > this.CACHE_TTL * 1000) {
          await this.redis.del(key);
          continue;
        }
        
        // Compare embeddings
        if (entry.embedding) {
          const similarity = this.calculateSimilarity(inputEmbedding, entry.embedding);
          if (similarity > this.SIMILARITY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { key, similarity };
          }
        }
      }
      
      if (bestMatch) {
        const entry: CacheEntry = JSON.parse(await this.redis.get(bestMatch.key) || '{}');
        console.log(`[CacheClient] Cache hit with similarity ${bestMatch.similarity}`);
        return {
          ...entry.response,
          metadata: {
            ...entry.response.metadata,
            cached: true,
            cacheSimilarity: bestMatch.similarity
          }
        };
      }
      
      return null;
    } catch (error) {
      console.error('[CacheClient] Error getting from cache:', error);
      return null;
    }
  }

  async set(input: string, response: AgentResponse): Promise<void> {
    try {
      const embedding = await this.getEmbedding(input);
      const entry: CacheEntry = {
        response,
        timestamp: Date.now(),
        embedding
      };
      
      const key = `cache:${Buffer.from(input).toString('base64')}`;
      await this.redis.set(key, JSON.stringify(entry));
      
      // Set TTL
      await this.redis.expire(key, this.CACHE_TTL);
      
      // Maintain cache size
      const cacheSize = await this.redis.dbsize();
      if (cacheSize > this.MAX_CACHE_SIZE) {
        const keys = await this.redis.keys('cache:*');
        // Remove oldest entries
        for (const key of keys.slice(0, keys.length - this.MAX_CACHE_SIZE)) {
          await this.redis.del(key);
        }
      }
      
      console.log(`[CacheClient] Cached response for input: ${input.substring(0, 50)}...`);
    } catch (error) {
      console.error('[CacheClient] Error setting cache:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      console.log('[CacheClient] Cache cleared');
    } catch (error) {
      console.error('[CacheClient] Error clearing cache:', error);
    }
  }
} 