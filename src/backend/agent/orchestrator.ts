import { R1Client } from '../lib/r1-client';
import { CacheClient } from '../lib/cache-client';
import { config } from 'dotenv';

// Load environment variables
config();

// Response types for structured outputs
export interface AgentResponse {
  text: string;
  source?: string;
  confidence?: number;
  metadata?: {
    cached?: boolean;
    cacheSimilarity?: number;
    ragResults?: any[];
    toolCalls?: ToolCall[];
    buttons?: any[];
    error?: string;
  };
}

export interface ToolCall {
  tool: string;
  params: Record<string, any>;
}

// Tool interfaces
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  execute: (params: Record<string, any>) => Promise<AgentResponse>;
}

export class AgentOrchestrator {
  private r1Client: R1Client;
  private cacheClient: CacheClient;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    this.r1Client = new R1Client(process.env.GITHUB_TOKEN);
    this.cacheClient = new CacheClient();
  }

  async processUserInput(input: string): Promise<AgentResponse> {
    try {
      console.log('[Orchestrator] Processing input:', input);

      // 1. Check cache first with semantic similarity
      const cachedResponse = await this.cacheClient.get(input);
      if (cachedResponse) {
        console.log('[Orchestrator] Cache hit with similarity:', cachedResponse.metadata?.cacheSimilarity);
        return cachedResponse;
      }

      // 2. Process with R1 (which now handles RAG internally)
      const response = await this.r1Client.analyze({
        userInput: input
      });

      const agentResponse: AgentResponse = {
        text: response.content,
        source: response.metadata?.source || 'r1',
        confidence: response.metadata?.confidence,
        metadata: {
          ragResults: response.metadata?.ragResults,
          toolCalls: response.toolCalls,
          buttons: response.buttons
        }
      };

      // Only cache high-confidence responses
      if (response.metadata?.confidence && response.metadata.confidence > 0.7) {
        console.log('[Orchestrator] Caching high-confidence response');
        await this.cacheClient.set(input, agentResponse);
      }
      
      return agentResponse;
    } catch (error) {
      console.error('[Orchestrator] Error in processUserInput:', error);
      
      // Return a graceful error response
      return {
        text: "I apologize, but I encountered an error while processing your request. This might be temporary - please try again in a moment.",
        source: 'error',
        confidence: 0,
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  async clearCache(): Promise<void> {
    await this.cacheClient.clear();
  }
}

// Export a singleton instance
export const orchestrator = new AgentOrchestrator();

export async function handleUserMessage(message: string, userId: string) {
  try {
    return await orchestrator.processUserInput(message);
  } catch (error) {
    console.error('[handleUserMessage] Error:', error);
    throw error;
  }
} 