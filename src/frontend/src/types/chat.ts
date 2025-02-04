import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: string;
  error?: boolean;
  buttons?: ChatButton[];
  source?: string;
  metadata?: ChatMetadata;
}

export interface ChatButton {
  id: string;
  label: string;
  type: 'action' | 'chat';
  action?: 'email' | 'phone' | 'website';
  value?: string;
}

export interface ChatMetadata {
  confidence?: number;
  cached?: boolean;
  cacheSimilarity?: number;
  ragResults?: any[];
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  content: string;
  source?: string;
  buttons?: ChatButton[];
  metadata?: ChatMetadata;
}

export interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<ChatResponse>;
  onStartRecording: () => Promise<void>;
  onButtonClick?: (buttonId: string) => void;
}

// Helper function to create error messages
export const createErrorMessage = (content: string, error: unknown): ChatMessage => ({
  id: uuidv4(),
  content,
  sender: 'system',
  timestamp: new Date().toISOString(),
  error: true,
  metadata: {
    error: error instanceof Error ? error.message : String(error)
  }
}); 