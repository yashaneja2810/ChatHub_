import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Trash2,
  Phone,
  Video,
  Info,
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { useTyping } from '../../hooks/useTyping';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Database } from '../../types/supabase';
import { Input } from '../ui/Input';
import { EmojiPicker } from '../ui/EmojiPicker';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
};

interface ChatInfo {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatar_url: string | null;
  other_user?: {
    full_name: string;
    username: string;
    is_online: boolean;
    last_seen: string;
  };
  member_count?: number;
  members: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    member_role: 'admin' | 'member';
  }[];
}

interface ChatMemberProfile {
  id: string;
  full_name: string;
  username: string;
  is_online: boolean;
  last_seen: string;
  avatar_url: string | null;
}

interface ChatMember {
  user_id: string;
  role: string;
  profiles: ChatMemberProfile;
}

interface ChatWindowProps {
  chatId: string;
  onBack: () => void;
  onShowFriends: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, onBack, onShowFriends }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { typingUsers, startTyping, stopTyping } = useTyping(chatId, user?.id || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout;

    const fetchMessages = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch chat info first
        await fetchChatInfo();

        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            chat_id,
            profiles!inner (
              id,
              full_name,
              username,
              avatar_url
            )
          `)
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        if (mounted) {
          setMessages(
            (messages as unknown as Array<Message & { profiles: Profile }>).map(
              (message) => ({
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                sender_id: message.sender_id,
                chat_id: message.chat_id,
                sender: {
                  id: message.profiles.id,
                  name: message.profiles.full_name,
                  username: message.profiles.username,
                  avatar_url: message.profiles.avatar_url,
                },
              })
            )
          );
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        if (mounted) {
          setError('Failed to load messages. Please try again.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const pollForNewMessages = async () => {
      if (!user) return;

      try {
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            chat_id,
            profiles!inner (
              id,
              full_name,
              username,
              avatar_url
            )
          `)
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        if (mounted && messages) {
          setMessages((currentMessages) => {
            const newMessages = (messages as unknown as Array<Message & { profiles: Profile }>).map(
              (message) => ({
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                sender_id: message.sender_id,
                chat_id: message.chat_id,
                sender: {
                  id: message.profiles.id,
                  name: message.profiles.full_name,
                  username: message.profiles.username,
                  avatar_url: message.profiles.avatar_url,
                },
              })
            );

            // Only update if there are new messages
            if (newMessages.length > currentMessages.length) {
              return newMessages;
            }
            return currentMessages;
          });
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    };

    // Initial fetch
    fetchMessages();

    // Set up polling interval
    pollInterval = setInterval(pollForNewMessages, 1000);

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          console.log('New message received:', payload);
          if (mounted) {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, username, avatar_url')
                .eq('id', payload.new.sender_id)
                .single();

              if (profileError) {
                console.error('Error fetching sender profile:', profileError);
                return;
              }

              if (profile) {
                const newMessage = {
                  id: payload.new.id,
                  content: payload.new.content,
                  created_at: payload.new.created_at,
                  sender_id: payload.new.sender_id,
                  chat_id: payload.new.chat_id,
                  sender: {
                    id: profile.id,
                    name: profile.full_name,
                    username: profile.username,
                    avatar_url: profile.avatar_url,
                  },
                };

                console.log('Adding new message:', newMessage);
                setMessages((prev) => [...prev, newMessage]);
                scrollToBottom();
              }
            } catch (error) {
              console.error('Error handling new message:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      channel.unsubscribe();
    };
  }, [chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time message updates
  useRealtime(
    'messages',
    `chat_id=eq.${chatId}`,
    (payload) => {
      const newMessage = payload.new as Message;
      // Fetch sender info
      fetchMessageWithSender(newMessage.id);
    },
    undefined,
    (payload) => {
      setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
    }
  );

  const fetchMessageWithSender = async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender_id,
        chat_id,
        profiles (
          id,
          full_name,
          username,
          avatar_url
        )
      `)
      .eq('id', messageId)
      .single();

    if (error) {
      console.error('Error fetching message:', error);
      return;
    }

    if (data) {
      const message = data as unknown as Message & { profiles: Profile };
      setMessages(prev => [
        ...prev,
        {
          id: message.id,
          content: message.content,
          created_at: message.created_at,
          sender_id: message.sender_id,
          chat_id: message.chat_id,
          sender: {
            id: message.profiles.id,
            name: message.profiles.full_name,
            username: message.profiles.username,
            avatar_url: message.profiles.avatar_url,
          },
        },
      ]);
    }
  };

  const fetchChatInfo = async () => {
    try {
      // First, get the basic chat info
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id, type, name, avatar_url')
        .eq('id', chatId)
        .single();

      if (chatError) {
        console.error('Error fetching chat:', chatError);
        throw chatError;
      }

      console.log('Chat data:', chat);

      // Then, get the chat members with their profiles
      const { data: members, error: membersError } = await supabase
          .from('chat_members')
          .select(`
            user_id,
          role,
          profiles (
            id,
            full_name,
            username,
            is_online,
            last_seen,
            avatar_url
          )
        `)
        .eq('chat_id', chatId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
        throw membersError;
      }

      console.log('Raw members data:', members);
      console.log('Current user ID:', user?.id);

      if (!members || members.length === 0) {
        console.error('No members found for chat:', chatId);
        throw new Error('No members found in chat');
      }

      const typedMembers = members as unknown as ChatMember[];

      if (chat.type === 'direct') {
        // Find the other user in the chat
        const otherMember = typedMembers.find(m => m.user_id !== user?.id);
        
        console.log('Other member search:', {
          allMembers: typedMembers,
          currentUserId: user?.id,
          foundMember: otherMember
        });

        if (!otherMember || !otherMember.profiles) {
          console.error('Other member not found:', {
            members: typedMembers,
            currentUserId: user?.id,
            chatId: chatId
          });
          throw new Error('Could not find other chat member');
        }

        setChatInfo({
          id: chat.id,
          type: chat.type,
          name: otherMember.profiles.full_name || 'Unknown User',
          avatar_url: otherMember.profiles.avatar_url,
          other_user: {
            full_name: otherMember.profiles.full_name,
            username: otherMember.profiles.username,
            is_online: otherMember.profiles.is_online,
            last_seen: otherMember.profiles.last_seen,
          },
          members: [
            {
              id: otherMember.profiles.id,
              full_name: otherMember.profiles.full_name,
              username: otherMember.profiles.username,
              avatar_url: otherMember.profiles.avatar_url,
              member_role: otherMember.role as 'admin' | 'member',
            },
          ],
        });
      } else {
        // Group chat
        const formattedMembers = typedMembers.map(member => ({
          id: member.profiles.id,
          full_name: member.profiles.full_name,
          username: member.profiles.username,
          avatar_url: member.profiles.avatar_url,
          member_role: member.role as 'admin' | 'member',
        }));

        setChatInfo({
          id: chat.id,
          type: chat.type,
          name: chat.name || 'Unnamed Group',
          avatar_url: chat.avatar_url,
          member_count: formattedMembers.length,
          members: formattedMembers,
        });
      }
    } catch (error) {
      console.error('Error fetching chat info:', error);
      setError('Failed to load chat information');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    stopTyping();

    try {
      const { error } = await supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: user.id,
          content: newMessage.trim(),
        },
      ]);

      if (error) throw error;

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    startTyping();
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user?.id);

      if (error) throw error;
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const deleteAllMessages = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId)
        .eq('sender_id', user?.id);

      if (error) throw error;
      toast.success('All your messages deleted');
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Failed to delete messages');
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prevMessage => prevMessage + emoji);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="primary"
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-shrink-0 mr-3">
            <div className="relative">
              <img
                src={chatInfo?.other_user?.avatar_url || '/default-avatar.png'}
                alt={chatInfo?.other_user?.full_name || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />
              {chatInfo?.other_user?.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {chatInfo?.other_user?.full_name || 'Loading...'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {chatInfo?.other_user?.is_online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={onShowFriends}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.sender_id === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
            <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
            <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className={`p-2 rounded-full ${
              newMessage.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        {showEmojiPicker && (
          <div className="absolute bottom-20 right-4">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
        )}
      </div>
    </div>
  );
};