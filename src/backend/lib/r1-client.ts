import { default as ModelClient, ChatCompletionsOutput } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { createSseStream } from "@azure/core-sse";
import { IncomingMessage } from 'http';
import { SupabaseRAG } from './supabase-client.js';
import { Tool, tools } from './tools.js';
import { log } from './logger.js';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface ChatChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
  index: number;
}

interface ErrorResponse {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
}

interface AnalyzeRequest {
  userInput: string;
  context?: Record<string, any>;
  availableTools?: Tool[];
}

interface AnalyzeResponse {
  content: string;
  buttons?: Array<{
    id: string;
    label: string;
    action: string;
  }>;
  toolCalls?: Array<{
    tool: string;
    params: Record<string, any>;
  }>;
  metadata?: {
    confidence?: number;
    source?: string;
    ragResults?: any[];
    toolsUsed?: string[];
    error?: string;
  };
}

interface GenerateRequest {
  userInput: string;
  toolResults: any[];
  context?: Record<string, any>;
}

export interface R1Analysis {
  toolName?: string;
  parameters?: Record<string, any>;
}

interface RAGResult {
  confidence: number;
  content: string;
  metadata?: any;
}

interface AzureResponse {
  body: {
    error?: {
      message: string;
    };
    choices?: Array<{
      message: {
        content: string;
        role: string;
      };
      finish_reason?: string;
      index: number;
    }>;
    model?: string;
    usage?: {
      total_tokens: number;
      prompt_tokens: number;
      completion_tokens: number;
    };
  };
  status: string;
}

export class R1Client {
  private client: ReturnType<typeof ModelClient>;
  private modelName: string = "gpt-4o-mini";
  private conversationHistory: ChatMessage[] = [];
  private endpoint: string = "https://models.inference.ai.azure.com";
  private rag: SupabaseRAG;
  
  // Confidence thresholds for RAG
  private readonly RAG_HIGH_CONFIDENCE = 0.8;
  private readonly RAG_MIN_CONFIDENCE = 0.6;
  private readonly MAX_RETRIES = 2;
  private readonly TIMEOUT_MS = 15000; // 15 seconds timeout

  constructor(githubToken: string) {
    if (!githubToken) {
      throw new Error('GitHub token is required for R1Client initialization');
    }
    
    this.client = ModelClient(
      this.endpoint,
      new AzureKeyCredential(githubToken)
    );

    this.rag = new SupabaseRAG();
    console.log('[R1Client] Initialized with endpoint:', this.endpoint);
  }

  private isErrorResponse(response: unknown): response is ErrorResponse {
    return response != null && 
           typeof response === 'object' && 
           'error' in response &&
           typeof (response as ErrorResponse).error?.message === 'string';
  }

  private isChatResponse(response: unknown): response is AzureResponse {
    const azureResponse = response as AzureResponse;
    return response != null && 
           typeof response === 'object' && 
           'body' in response &&
           azureResponse.body != null &&
           'choices' in azureResponse.body &&
           Array.isArray(azureResponse.body.choices);
  }

  private ensureString(value: string | null | undefined): string {
    if (typeof value !== 'string' || !value) {
      throw new Error('Expected string value but received null or undefined');
    }
    return value;
  }

  private formatToolsForPrompt(tools: Tool[]): string {
    if (!tools || tools.length === 0) return '';
    
    return tools.map(tool => `
      Tool: ${tool.name}
      Description: ${tool.description}
      Parameters: ${Object.entries(tool.parameters).map(([name, param]) => 
        `- ${name} (${param.type}${param.required ? ', required' : ''}): ${param.description}`
      ).join('\n')}
    `).join('\n');
  }

  private async enrichWithRAG(input: string): Promise<RAGResult> {
    try {
      // Search knowledge base with lower threshold for better recall
      const searchResults = await this.rag.search(input);

      log.debug('RAG search results:', { results: searchResults });

      if (!searchResults?.length) {
        return { confidence: 0, content: '' };
      }

      // Calculate confidence based on relevance score
      const topResult = searchResults[0];
      const confidence = this.calculateConfidence(topResult, input);

      return {
        confidence,
        content: topResult.content,
        metadata: topResult.metadata
      };
    } catch (error) {
      log.error('Error enriching with RAG:', error);
      return { confidence: 0, content: '' };
    }
  }

  private calculateConfidence(result: any, query: string): number {
    // If we have a similarity score from RAG, use that
    if (result.similarity !== undefined) {
      return result.similarity;
    }

    // Fallback to term matching if no similarity score
    const queryTerms = query.toLowerCase().split(' ');
    const contentTerms = result.content.toLowerCase().split(' ');
    
    let matches = 0;
    queryTerms.forEach(term => {
      if (contentTerms.includes(term)) matches++;
    });

    return matches / queryTerms.length;
  }

  private addToHistory(role: string, content: string) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });

    // Keep history manageable
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    console.log(`[R1Client] Added to history - Role: ${role}, Content length: ${content.length}`);
  }

  private async makeAPICallWithRetry(messages: ChatMessage[], retryCount = 0): Promise<ChatCompletionsOutput> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`API request timed out after ${this.TIMEOUT_MS}ms`)), this.TIMEOUT_MS);
      });

      const responsePromise = this.client.path("/chat/completions").post({
        body: {
          messages,
          model: this.modelName,
          temperature: 1.0,
          top_p: 1.0,
          max_tokens: 1000
        }
      });

      const response = await Promise.race([responsePromise, timeoutPromise]) as AzureResponse;
      
      log.debug('Raw API response:', response.body);

      // Check for API-level errors
      if (response.body?.error) {
        throw new Error(`API error: ${response.body.error.message}`);
      }

      // Return the response body directly since it matches our expected format
      return response.body as ChatCompletionsOutput;

    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        log.info(`Retrying API call (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.makeAPICallWithRetry(messages, retryCount + 1);
      }
      throw error;
    }
  }

  private buildSystemMessage(tools: Tool[] | undefined): string {
    if (!tools || tools.length === 0) return '';
    
    return `You are Magent, a helpful AI assistant. Always provide meaningful responses, never echo back the user's input.

Available tools:
${this.formatToolsForPrompt(tools)}

When responding:
1. Be direct and informative
2. Use natural language
3. If confidence is low (< ${this.RAG_MIN_CONFIDENCE * 100}%), explicitly state uncertainty
4. Never just repeat the user's question
5. If a tool would be helpful, suggest using it
6. Cite sources using [1], [2], etc. when using RAG information
7. Use markdown-style bold (**text** or __text__) for emphasis on key terms and important information
8. Use relevant emojis to make responses more engaging (e.g., 📅 for calendar, 📧 for email, ✨ for features)

Dynamic Buttons:
Based on the conversation context, include both action buttons and chat buttons. Format them as JSON at the end of your response like this:
{
  "buttons": [
    {
      "id": "unique_id",
      "label": "Button Text",
      "type": "action",  // Use 'action' for email/phone/website, 'chat' for conversation
      "action": "email|phone|website",  // Required for action buttons
      "value": "actual_value"  // email address, phone number, or URL
    }
  ]
}

Example button scenarios:
- For contact information:
  {
    "buttons": [
      {
        "id": "email-contact",
        "label": "📧 Send Email",
        "type": "action",
        "action": "email",
        "value": "info@gelida.co.uk"
      },
      {
        "id": "phone-contact",
        "label": "📞 Call Now",
        "type": "action",
        "action": "phone",
        "value": "03300562431"
      },
      {
        "id": "visit-website",
        "label": "🌐 Visit Website",
        "type": "action",
        "action": "website",
        "value": "https://gelida.co.uk"
      }
    ]
  }

- For chat follow-ups:
  {
    "buttons": [
      {
        "id": "learn_more",
        "label": "Learn More",
        "type": "chat"
      }
    ]
  }`;
  }

  private parseResponseContent(content: string): { text: string; buttons?: Array<{ id: string; label: string; action: string }> } {
    try {
      // Look for JSON block at the end of the response
      const jsonMatch = content.match(/\{[\s\S]*\}$/);
      if (!jsonMatch) {
        return { text: content };
      }

      // Extract the main text and JSON parts
      const text = content.slice(0, jsonMatch.index).trim();
      const buttonsData = JSON.parse(jsonMatch[0]);

      return {
        text,
        buttons: buttonsData.buttons
      };
    } catch (error) {
      log.error('Error parsing response buttons:', error);
      return { text: content };
    }
  }

  public async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const requestId = Math.random().toString(36).substring(7);
    log.info(`[R1Client:${requestId}] Starting analysis for input: ${request.userInput}`);

    try {
      // Get enriched input from RAG
      const ragResult = await this.enrichWithRAG(request.userInput);
      log.info(`[R1Client:${requestId}] RAG enrichment:`, { 
        confidence: ragResult.confidence,
        hasContent: !!ragResult.content 
      });

      // Build messages array with RAG content if confidence is good
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: this.buildSystemMessage(request.availableTools)
        }
      ];

      // Add RAG content if confidence is good
      if (ragResult.confidence > 0.3 && ragResult.content) {
        messages.push({
          role: "system",
          content: `Relevant context:\n${ragResult.content}`
        });
      }

      messages.push({
        role: "user",
        content: request.userInput
      });

      log.info(`[R1Client:${requestId}] Sending messages to API:`, messages);

      const response = await this.makeAPICallWithRetry(messages);

      // Check if response is error
      if (this.isErrorResponse(response)) {
        log.error(`[R1Client:${requestId}] API error:`, response.error);
        throw new Error(`API error: ${response.error.message}`);
      }

      const messageContent = response.choices?.[0]?.message?.content;
      if (!messageContent) {
        log.error(`[R1Client:${requestId}] No content in response:`, response);
        throw new Error('No content in response');
      }

      log.info(`[R1Client:${requestId}] Received response:`, {
        contentLength: messageContent.length,
        firstLine: messageContent.split('\n')[0]
      });

      // Parse the response content for text and buttons
      const { text, buttons } = this.parseResponseContent(messageContent);

      // Include tool calls if available tools exist
      const toolCalls = request.availableTools && request.availableTools.length > 0 
        ? [{
            tool: request.availableTools[0].name,
            params: request.availableTools[0].parameters || {}
          }] 
        : undefined;

      return {
        content: text,
        buttons,
        toolCalls,
        metadata: {
          confidence: ragResult.confidence > this.RAG_HIGH_CONFIDENCE ? ragResult.confidence : 0.5,
          source: ragResult.confidence > this.RAG_MIN_CONFIDENCE ? 'rag' : 'general',
          ragResults: ragResult.content ? [ragResult.content] : [],
          toolsUsed: toolCalls ? [request.availableTools![0].name] : []
        }
      };

    } catch (error) {
      log.error(`[R1Client:${requestId}] Analysis error:`, error);
      return {
        content: `I apologize, but I encountered an error while processing your request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        metadata: {
          confidence: 0,
          source: 'error',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  async generateResponse(request: GenerateRequest): Promise<AnalyzeResponse> {
    try {
      const systemPrompt = `Based on the tool execution results, provide a helpful response.
      If appropriate, include buttons for follow-up actions.
      Use markdown-style bold (**text** or __text__) for emphasis on key terms and important information.
      Add relevant emojis to make the response more engaging and visual.
      
      Tool Results:
      ${JSON.stringify(request.toolResults, null, 2)}`;

      const response = await this.client.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: request.userInput }
          ],
          model: this.modelName,
          temperature: 0.7,
          max_tokens: 1000
        }
      });

      if (!response.body) {
        throw new Error('Empty response body');
      }

      // Check for API-level errors
      if ('error' in response.body) {
        throw new Error(`API error: ${response.body.error.message}`);
      }

      // At this point we know it's a successful response
      const chatResponse = response.body as ChatCompletionsOutput;
      const messageContent = this.ensureString(chatResponse.choices?.[0]?.message?.content);

      try {
        return JSON.parse(messageContent);
      } catch {
        return {
          content: messageContent
        };
      }
    } catch (error) {
      console.error('R1 generate error:', error);
      throw error;
    }
  }

  async streamResponse(userInput: string) {
    try {
      // Get enriched input from RAG first
      const ragResult = await this.enrichWithRAG(userInput);
      log.info('RAG enrichment for stream:', { 
        confidence: ragResult.confidence,
        hasContent: !!ragResult.content 
      });

      // Build messages array with RAG content if confidence is good
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: "You are Magent, a helpful AI assistant. Always provide meaningful responses, never echo back the user's input. Use markdown-style bold (**text** or __text__) for emphasis on key terms and important information. Add relevant emojis to make your responses more engaging and visual."
        }
      ];

      // Add RAG content if confidence is good
      if (ragResult.confidence > 0.3 && ragResult.content) {
        messages.push({
          role: "system",
          content: `Relevant context:\n${ragResult.content}`
        });
      }

      messages.push({
        role: "user",
        content: userInput
      });

      log.info('Initiating streaming response with messages:', messages);

      const response = await this.client.path("/chat/completions").post({
        body: {
          messages,
          model: this.modelName,
          stream: true,
          temperature: 1.0,
          top_p: 1.0
        }
      }).asNodeStream();

      if (!response.body || response.status !== "200") {
        if (response.body instanceof IncomingMessage) {
          response.body.destroy();
        }
        throw new Error(`Failed to get chat completions: ${response.status}`);
      }

      if (!(response.body instanceof IncomingMessage)) {
        throw new Error("Invalid response stream type");
      }

      const sseStream = createSseStream(response.body);

      // Create an async generator to yield tokens
      async function* streamTokens() {
        for await (const event of sseStream) {
          try {
            if (event.data === "[DONE]") {
              return;
            }

            const parsed = JSON.parse(event.data);
            if (parsed.choices && parsed.choices.length > 0) {
              const content = parsed.choices[0].delta?.content;
              if (content) {
                yield content;
              }
            }
          } catch (error) {
            log.error('Error parsing stream chunk:', error);
            throw error instanceof Error ? error : new Error('Stream processing error');
          }
        }
      }

      return streamTokens();
    } catch (error) {
      log.error('Stream response error:', error);
      throw error;
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  async analyzeInput(input: string): Promise<R1Analysis> {
    try {
      const lowercaseInput = input.toLowerCase();
      
      // Calendar-related patterns
      if (lowercaseInput.includes('schedule') || 
          lowercaseInput.includes('calendar') || 
          lowercaseInput.includes('meeting') ||
          lowercaseInput.includes('appointment')) {
        return {
          toolName: 'Calendar',
          parameters: {
            action: lowercaseInput.includes('create') ? 'create' : 'view'
          }
        };
      }
      
      // Email-related patterns
      if (lowercaseInput.includes('email') || 
          lowercaseInput.includes('send') || 
          lowercaseInput.includes('mail') ||
          lowercaseInput.includes('message')) {
        return {
          toolName: 'Email',
          parameters: {
            action: lowercaseInput.includes('compose') ? 'compose' : 'read'
          }
        };
      }

      // No specific tool needed
      return {
        toolName: undefined,
        parameters: {}
      };
    } catch (error) {
      console.error('Error in analyzeInput:', error);
      return {
        toolName: undefined,
        parameters: {}
      };
    }
  }

  async getResponse(input: string): Promise<string> {
    const response = await this.analyze({ 
      userInput: input,
      availableTools: tools // Pass all available tools
    });
    return response.content;
  }
} 