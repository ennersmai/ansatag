import React, { useState, ChangeEvent } from 'react';
import Button from '../ui/button.js';
import Input from '../ui/input.js';

interface ChatInputProps {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        value={input}
        onChange={handleChange}
        placeholder="Type your message..."
      />
      <Button type="submit">Send</Button>
    </form>
  );
} 