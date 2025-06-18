import React, { useRef, useState } from 'react';
import { Smile, Send, Paperclip, Image as ImageIcon } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast.error('Only images and videos are supported');
        setUploading(false);
        return;
      }
      const filePath = `${chatId}/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      const type = isImage ? 'image' : 'video';
      const { error } = await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: user.id,
          content: publicUrl,
          type,
        },
      ]);
      if (error) throw error;
      toast.success(`${isImage ? 'Image' : 'Video'} sent!`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to send file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        toast.error('Only images are supported');
        setUploading(false);
        return;
      }
      const filePath = `${chatId}/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      const { error } = await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: user.id,
          content: publicUrl,
          type: 'image',
        },
      ]);
      if (error) throw error;
      toast.success('Image sent!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to send image');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-transparent animate-fade-in">
      <div className="flex items-end space-x-2 bg-white/60 dark:bg-black/60 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 transition-all duration-300">
        {/* Media buttons: always visible, before textarea */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="p-2 bg-white/70 dark:bg-black/70 rounded-full text-blue-500 dark:text-purple-400 hover:bg-blue-100 dark:hover:bg-purple-900 shadow transition-all duration-200"
          disabled={uploading}
          title="Send image"
        >
          <ImageIcon className="h-5 w-5" />
        </button>
        <input
          type="file"
          accept="image/*"
          ref={imageInputRef}
          onChange={handleImageChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 bg-white/70 dark:bg-black/70 rounded-full text-blue-500 dark:text-purple-400 hover:bg-blue-100 dark:hover:bg-purple-900 shadow transition-all duration-200"
          disabled={uploading}
          title="Attach image or video"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          type="file"
          accept="image/*,video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsEmojiPickerOpen(false)}
            placeholder="Type a message..."
            className="w-full resize-none rounded-full border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-black/80 text-gray-900 dark:text-white p-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-purple-500 focus:border-transparent shadow-md transition-all duration-300"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            rows={1}
          />
          <button
            type="button"
            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
            className="absolute right-3 bottom-3 bg-white/70 dark:bg-black/70 backdrop-blur rounded-full p-2 text-blue-500 dark:text-purple-400 hover:bg-blue-100 dark:hover:bg-purple-900 shadow transition-all duration-200"
          >
            <Smile className="h-5 w-5" />
          </button>
          {isEmojiPickerOpen && (
            <div className="absolute bottom-full right-0 mb-2 z-10 animate-fade-in">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={!message.trim()}
          className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-lg text-white flex items-center justify-center p-0 border-0 transition-all duration-200 hover:scale-110 focus:ring-4 focus:ring-blue-300 dark:from-purple-900 dark:via-blue-900 dark:to-black animate-pulse"
        >
          <Send className="h-6 w-6" />
        </Button>
      </div>
    </form>
  );
};

export default ChatInput; 