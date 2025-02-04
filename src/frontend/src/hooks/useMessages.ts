import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatResponse } from '../types/chat';
import { createErrorMessage } from '../types/chat';

interface UseMessagesReturn {
  messages: ChatMessage[];
  addUserMessage: (content: string) => void;
  addSystemMessage: (response: ChatResponse) => void;
  addErrorMessage: (content: string, error: unknown) => void;
  clearMessages: () => void;
}

const DEFAULT_MESSAGES: ChatMessage[] = [{
  id: uuidv4(),
  content: 'Hi, how can I help you? You can type your question or start a voice call with me',
  sender: 'system',
  timestamp: new Date().toISOString(),
  buttons: [
    { id: 'help', label: 'Help me get started', action: 'help' },
    { id: 'features', label: 'Show features', action: 'features' },
    { id: 'examples', label: 'See examples', action: 'examples' },
    { id: 'about', label: 'About Magent', action: 'about' }
  ]
}];

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);

  const addUserMessage = useCallback((content: string) => {
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
  }, []);

  const addSystemMessage = useCallback((response: ChatResponse) => {
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      content: response.content || response.text,
      sender: 'system',
      timestamp: new Date().toISOString(),
      buttons: response.buttons,
      source: response.source,
      metadata: response.metadata
    };
    setMessages(prev => [...prev, systemMessage]);
  }, []);

  const addErrorMessage = useCallback((content: string, error: unknown) => {
    const errorMessage = createErrorMessage(content, error);
    setMessages(prev => [...prev, errorMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages(DEFAULT_MESSAGES);
  }, []);

  return {
    messages,
    addUserMessage,
    addSystemMessage,
    addErrorMessage,
    clearMessages
  };
} 