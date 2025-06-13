import React, { useRef, useState } from 'react';
import { Smile, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiPicker } from '@/components/EmojiPicker';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

const ChatInput: React.FC = () => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [chatId, setChatId] = useState('');
  const [user, setUser] = useState(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatId || !user) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            chat_id: chatId,
            sender_id: user.id,
            content: message.trim(),
            type: 'text'
          }
        ]);

      if (error) throw error;

      setMessage('');
      // Don't blur the input to keep keyboard open
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    // Handle emoji selection
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsEmojiPickerOpen(false)}
            placeholder="Type a message..."
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            rows={1}
          />
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className="absolute right-2 bottom-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Smile className="h-5 w-5" />
          </button>
          {isEmojiPickerOpen && (
            <div className="absolute bottom-full right-0 mb-2">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={!message.trim()}
          className="h-11 px-4"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
};

export default ChatInput; 