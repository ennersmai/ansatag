import type { ChatResponse, ChatButton, ChatMetadata } from '../types/chat';

// Ensure this matches your backend URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ChatAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      console.log('[API Client] Sending message:', message);

      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      console.log('[API Client] Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[API Client] Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await response.json();
      console.log('[API Client] Success Response:', data);

      // Ensure the response matches our ChatResponse type
      const chatResponse: ChatResponse = {
        content: data.content || '',
        text: data.text || data.content || '',  // Fallback to content if text is missing
        source: data.source,
        buttons: data.buttons as ChatButton[],
        metadata: data.metadata as ChatMetadata
      };

      return chatResponse;
    } catch (error) {
      console.error('[API Client] Request failed:', error);
      throw error;
    }
  }

  async startStream(message: string): Promise<EventSource> {
    const eventSource = new EventSource(
      `${this.baseUrl}/chat/stream?message=${encodeURIComponent(message)}`
    );

    eventSource.onerror = (error) => {
      console.error('[API Client] Stream error:', error);
      eventSource.close();
    };

    return eventSource;
  }
}

export const chatAPI = new ChatAPI(); 