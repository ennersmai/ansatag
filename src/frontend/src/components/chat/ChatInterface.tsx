import { 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  FC,
  ReactElement,
  KeyboardEvent,
  ChangeEvent,
} from 'react';
import { Send, Mic, User, Bot, Copy, ArrowDown, Check, Loader2, MicOff, AlertCircle, ChevronRight } from 'lucide-react';
import Button from '../ui/button.js';
import Input from '../ui/input.js';
import { Avatar, AvatarFallback } from '../ui/avatar.js';
import type { ChatInterfaceProps } from '../../types/chat';
import { useMessages } from '../../hooks/useMessages';

const gradientAnimation = `
  @keyframes gradientFlow {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .gradient-line {
    height: 3px;
    width: 100%;
    background: linear-gradient(90deg, #9333ea, #3b82f6, #9333ea);
    background-size: 200% 100%;
    animation: gradientFlow 6s linear infinite;
  }

  .gradient-border {
    position: relative;
    background: white;
  }

  .gradient-border::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1rem;
    padding: 2px;
    background: linear-gradient(90deg, #9333ea, #3b82f6, #9333ea);
    background-size: 200% 100%;
    animation: gradientFlow 8s linear infinite;
    -webkit-mask: 
      linear-gradient(#fff 0 0) content-box, 
      linear-gradient(#fff 0 0);
    mask: 
      linear-gradient(#fff 0 0) content-box, 
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }

  .gradient-border-reverse::before {
    animation-direction: reverse;
  }

  .active-call {
    animation: gradientFlow 3s linear infinite;
  }
`;

interface DynamicButton {
  id: string;
  label: string;
  type: 'action' | 'chat';
  action?: 'email' | 'phone' | 'website';
  value?: string;
}

// Update the helper function to handle nested markdown elements
const renderMessageWithBold = (text: string): (ReactElement | ReactElement[])[] => {
  // First split by markdown links [text](url)
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  
  return parts.map((part, index) => {
    // Check if part is a markdown link
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [_, text, url] = linkMatch;
      if (url.startsWith('mailto:')) {
        return <span key={index}>{text}</span>;
      }
      if (url.startsWith('tel:')) {
        return <span key={index}>{text}</span>;
      }
      return <span key={index}>{text}</span>;
    }

    // If not a link, process bold text
    const boldParts = part.split(/(\*\*.*?\*\*|__.*?__)/g);
    return boldParts.map((boldPart, boldIndex) => {
      if ((boldPart.startsWith('**') && boldPart.endsWith('**')) || 
          (boldPart.startsWith('__') && boldPart.endsWith('__'))) {
        const content = boldPart.slice(2, -2);
        return <strong key={`${index}-${boldIndex}`}>{content}</strong>;
      }
      return <span key={`${index}-${boldIndex}`}>{boldPart}</span>;
    });
  });
};

const ChatInterface: FC<ChatInterfaceProps> = ({ 
  onSendMessage, 
  onStartRecording, 
  onButtonClick 
}): ReactElement => {
  const {
    messages,
    addUserMessage,
    addSystemMessage,
    addErrorMessage
  } = useMessages();
  
  const [message, setMessage] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (inputRef.current && !isInCall) {
        inputRef.current.focus();
      }
    }, 100);

    return () => clearInterval(focusInterval);
  }, [isInCall]);

  const handleSend = useCallback(async (): Promise<void> => {
    if (!message.trim() || isSending) return;

    try {
      setIsSending(true);
      setIsTyping(true);
      
      // Clear message immediately when sending
      setMessage('');
      
      // Add user message
      addUserMessage(message);
      
      // Get API response
      const response = await onSendMessage(message);
      
      // Add system response with full response object
      addSystemMessage({
        text: response.text || response.content,
        content: response.content,
        buttons: response.buttons,
        metadata: response.metadata,
        source: response.source
      });
    } catch (error) {
      console.error('Chat error:', error);
      addErrorMessage(
        'Sorry, there was an error processing your message. Please try again.',
        error
      );
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  }, [message, isSending, onSendMessage, addUserMessage, addSystemMessage, addErrorMessage]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(index);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const toggleCall = async (): Promise<void> => {
    try {
      setIsCallLoading(true);
      await onStartRecording();
      setIsInCall(!isInCall);
    } catch (error) {
      console.error('Voice call error:', error);
      addErrorMessage(
        'Sorry, there was an error with the voice call. Please try again.',
        error
      );
    } finally {
      setIsCallLoading(false);
    }
  };

  const handleButtonClick = async (button: DynamicButton): Promise<void> => {
    if (isSending) return;
    
    // Handle action buttons (email, phone, website)
    if (button.type === 'action' && button.action && button.value) {
      switch (button.action) {
        case 'email':
          window.open(`mailto:${button.value}`);
          break;
        case 'phone':
          window.open(`tel:+44${button.value.replace(/\D/g, '')}`);
          break;
        case 'website':
          window.open(button.value.startsWith('http') ? button.value : `https://${button.value}`, '_blank');
          break;
      }
      return;
    }
    
    // Handle regular chat buttons
    try {
      setIsSending(true);
      setIsTyping(true);
      
      addUserMessage(button.label);
      const response = await onSendMessage(button.label);
      addSystemMessage({
        text: response.text || response.content,
        content: response.content,
        buttons: response.buttons,
        metadata: response.metadata,
        source: response.source
      });
    } catch (error) {
      console.error('Button click error:', error);
      addErrorMessage(
        'Sorry, there was an error processing your request. Please try again.',
        error
      );
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  };

  // Update the message rendering part to include contact buttons
  const renderMessage = (msg: any) => {
    const content = renderMessageWithBold(msg.content);
    
    // Extract contact information from the message
    const emailMatch = msg.content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const phoneMatch = msg.content.match(/(?:\+44\s?)?(?:0)?(\d{3,4}[\s-]?\d{3}[\s-]?\d{3,4})/);
    const websiteMatch = msg.content.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);

    // Create contact buttons
    if (msg.sender === 'system' && !msg.error) {
      const contactButtons: DynamicButton[] = [];
      
      if (emailMatch) {
        contactButtons.push({
          id: `email-${emailMatch[1]}-${Date.now()}`,
          label: `Email`,
          action: 'email',
          value: emailMatch[1],
          type: 'action'
        });
      }
      
      if (phoneMatch) {
        const formattedPhone = phoneMatch[1].replace(/[\s-]/g, '');
        contactButtons.push({
          id: `phone-${formattedPhone}-${Date.now()}`,
          label: `Call`,
          action: 'phone',
          value: formattedPhone,
          type: 'action'
        });
      }
      
      if (websiteMatch) {
        contactButtons.push({
          id: `website-${websiteMatch[2]}-${Date.now()}`,
          label: `Visit Website`,
          action: 'website',
          value: websiteMatch[2],
          type: 'action'
        });
      }

      // Filter out any contact-related buttons from the original response
      const originalButtons = msg.buttons?.filter((b: DynamicButton) => 
        !b.action?.match(/^(email|phone|website)$/) && 
        !b.label?.match(/email|call|visit|website|contact|phone/i)
      ) || [];

      // If we have contact buttons, ONLY show those
      msg.buttons = contactButtons.length > 0 ? contactButtons : originalButtons;
    }

    return (
      <div className="px-4 py-2">
        <p className={`text-sm ${msg.error ? 'text-red-600' : 'text-gray-800'} whitespace-pre-line break-words`}>
          {content}
        </p>
      </div>
    );
  };

  return (
    <>
      <style>{gradientAnimation}</style>
      <div className="flex flex-col h-full w-full bg-white">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-4 px-6 py-3">
            <div className="flex items-center h-10 flex-shrink-0">
              <img 
                src="/ansatag_logo_on_white.png" 
                alt="Ansatag Logo" 
                className="h-full w-auto"
              />
            </div>
            <h2 className="text-sm font-medium text-gray-800 truncate">Ask me anything! I'm here to help</h2>
          </div>
          <div className="gradient-line" />
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 min-h-0 relative">
          <div 
            ref={messagesContainerRef}
            className="absolute inset-0 overflow-y-auto px-6 py-4 space-y-4"
          >
            {messages.map((msg, index) => (
              <div key={index} className="space-y-2">
                <div
                  className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
                >
                  <div className="flex-shrink-0">
                    <Avatar className={`h-8 w-8 flex items-center justify-center ${msg.sender === 'user' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}>
                      {msg.sender === 'system' ? (
                        <AvatarFallback className="text-white flex items-center justify-center">
                          {msg.error ? <AlertCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </AvatarFallback>
                      ) : (
                        <AvatarFallback className="text-white flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>

                  <div className="min-w-0 max-w-[70%] group">
                    <div className={`gradient-border break-words overflow-hidden ${msg.error ? 'border-red-500' : ''} ${msg.sender === 'user' ? '' : 'gradient-border-reverse'}`}>
                      {renderMessage(msg)}
                    </div>
                    {msg.sender === 'system' && !msg.error && (
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 mt-1 text-gray-500 hover:text-gray-700"
                      >
                        {copiedMessageId === index ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Buttons */}
                {msg.sender === 'system' && msg.buttons && msg.buttons.length > 0 && (
                  <div className="ml-11 flex flex-wrap gap-2">
                    {msg.buttons.map((button) => (
                      <button
                        key={button.id}
                        onClick={() => handleButtonClick(button)}
                        disabled={isSending && button.type === 'chat'}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors group
                          ${button.type === 'action' 
                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300' 
                            : 'text-gray-700 bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'} 
                          ${isSending && button.type === 'chat' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="truncate">{button.label}</span>
                        <ChevronRight className={`h-3 w-3 ${
                          button.type === 'action' 
                            ? 'text-blue-400 group-hover:text-blue-500'
                            : 'text-gray-400 group-hover:text-gray-500'
                        } transition-colors`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start space-x-3 mt-8">
                <div className="flex-shrink-0">
                  <Avatar className="h-8 w-8 flex items-center justify-center bg-gradient-to-r from-purple-500 to-blue-500">
                    <AvatarFallback className="text-white flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 max-w-[70%]">
                  <div className="gradient-border-reverse px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Scroll Button */}
          {showScrollButton && (
            <div className="absolute bottom-4 right-8 z-10">
              <button
                onClick={scrollToBottom}
                className="p-2 rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowDown className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0">
          <div className="gradient-line" />
          <div className="px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  type="text"
                  value={message}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... /   Start a call with me"
                  className="w-full h-12 pl-4 pr-4 rounded-full text-sm"
                  disabled={isSending}
                />
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <Button 
                  onClick={handleSend}
                  size="sm"
                  disabled={isSending || !message.trim()}
                  className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 p-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  onClick={toggleCall}
                  size="sm"
                  disabled={isCallLoading}
                  className={`h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 p-0 flex items-center justify-center ${isInCall ? 'active-call' : ''}`}
                >
                  {isCallLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isInCall ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatInterface; 