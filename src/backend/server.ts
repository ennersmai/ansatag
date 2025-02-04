// src/backend/server.ts
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { R1Client } from './lib/r1-client.js';
import { SupabaseRAG } from './lib/supabase-client.js';
import { tools } from './lib/tools.js';
import { log } from './lib/logger.js';

// Re-export SupabaseRAG for scripts
export { SupabaseRAG };

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  log.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize R1 client
if (!process.env.GITHUB_TOKEN) {
  console.error('\x1b[31m%s\x1b[0m', 'GITHUB_TOKEN environment variable is not set');
  process.exit(1);
}

const r1Client = new R1Client(process.env.GITHUB_TOKEN);

// Health check endpoint
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log('\x1b[36m%s\x1b[0m', `[${requestId}] Processing chat request`);
  
  try {
    const { message } = req.body;
    
    if (!message) {
      console.warn('\x1b[33m%s\x1b[0m', `[${requestId}] Received request without message`);
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('\x1b[36m%s\x1b[0m', `[${requestId}] Processing message:`, message);

    // Add request debugging
    console.log('\x1b[36m%s\x1b[0m', `[${requestId}] Request headers:`, req.headers);
    console.log('\x1b[36m%s\x1b[0m', `[${requestId}] GitHub token:`, process.env.GITHUB_TOKEN?.substring(0, 10) + '...');

    const response = await r1Client.analyze({
      userInput: message,
      availableTools: tools
    });

    // Check if it's an error response
    if (response.metadata?.source === 'error') {
      console.error('\x1b[31m%s\x1b[0m', `[${requestId}] Error in response:`, response.metadata.error);
      return res.status(500).json({
        error: response.content,
        requestId,
        timestamp: new Date().toISOString(),
        details: response.metadata.error
      });
    }

    // Log the full response for debugging
    console.log('\x1b[32m%s\x1b[0m', `[${requestId}] AI Response:`, JSON.stringify(response, null, 2));

    // Send the response with additional metadata
    const finalResponse = {
      ...response,
      requestId,
      timestamp: new Date().toISOString(),
      debug: {
        githubTokenPresent: !!process.env.GITHUB_TOKEN,
        toolsAvailable: tools.length
      }
    };

    console.log('\x1b[32m%s\x1b[0m', `[${requestId}] Sending response:`, JSON.stringify(finalResponse, null, 2));
    res.json(finalResponse);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `[${requestId}] Chat error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process message';
    const errorResponse = { 
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error : undefined
    };
    console.error('\x1b[31m%s\x1b[0m', `[${requestId}] Error response:`, JSON.stringify(errorResponse, null, 2));
    res.status(500).json(errorResponse);
  }
});

// Stream endpoint for real-time responses
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      console.warn('Received streaming request without message');
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received streaming message:', message);

    const stream = await r1Client.streamResponse(message);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const event of stream) {
      if (event.data === "[DONE]") {
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      res.write(`data: ${event.data}\n\n`);
    }
  } catch (error) {
    console.error('Stream error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process streaming message';
    
    // If headers haven't been sent yet, send error as JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    } else {
      // If headers were sent, send error as SSE
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const response = await r1Client.analyze({
      userInput: req.body.input,
      availableTools: tools
    });
    res.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze input' });
  }
});

// Start server
app.listen(port, () => {
  log.info(`Server started on port ${port}`, {
    env: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL
  });
});