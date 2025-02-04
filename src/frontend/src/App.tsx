// src/frontend/src/components/chat/ChatInterface.tsx
import React, { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  FC,
  ReactElement,
  KeyboardEvent,
  ChangeEvent
} from 'react';
import { Send, Mic, MicOff, Loader2, ArrowDown, AlertCircle } from 'lucide-react';
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { chatAPI } from '@/api/client';
import ChatInterface from "@/components/chat/ChatInterface";
import type { ChatResponse } from '@/types/chat';


interface DynamicButton {
  id: string;
  label: string;
  action: () => void;
}

interface Message {
  content: string;
  sender: string;
  error?: boolean;
  buttons?: DynamicButton[];
  source?: string;
}

interface ChatInterfaceProps {
  onSendMessage: (message: string) => Promise<{
    text: string;
    source?: string;
    buttons?: DynamicButton[];
  }>;
  onStartRecording: () => void;
  onButtonClick?: (buttonId: string) => void;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chat interface error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Oops! Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              The chat interface encountered an error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const handleSendMessage = async (message: string): Promise<ChatResponse> => {
    try {
      return await chatAPI.sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const handleStartRecording = async (): Promise<void> => {
    try {
      // Implement voice recording logic here
      console.log('Starting voice recording...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  };

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen flex bg-gray-50">
        <ChatInterface 
          onSendMessage={handleSendMessage}
          onStartRecording={handleStartRecording}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;