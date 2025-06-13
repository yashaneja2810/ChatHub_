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
    <div className="flex-1 flex flex-col bg-white dark:bg-black">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button onClick={onBack} variant="ghost" size="sm" className="p-2 lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                {chatInfo?.avatar_url ? (
                  <img
                    src={chatInfo.avatar_url}
                    alt={chatInfo.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  chatInfo?.name?.charAt(0)?.toUpperCase()
                )}
              </div>
              {chatInfo?.type === 'direct' && chatInfo?.other_user?.is_online && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {chatInfo?.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {chatInfo?.type === 'direct' ? (
                  chatInfo?.other_user?.is_online ? (
                    'Online'
                  ) : (
                    `Last seen ${formatDistanceToNow(new Date(chatInfo?.other_user?.last_seen || ''), { addSuffix: true })}`
                  )
                ) : (
                  `${chatInfo?.members.length} members`
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="p-2">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Info className="h-4 w-4" />
          </Button>
          <div className="relative group">
            <Button variant="ghost" size="sm" className="p-2">
              <MoreVertical className="h-4 w-4" />
            </Button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={deleteAllMessages}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All My Messages
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex ${msg.sender.id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-xs lg:max-w-md group ${
                msg.sender.id === user?.id ? 'order-2' : 'order-1'
              }`}>
                {msg.sender.id !== user?.id && (
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                      {msg.sender.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {msg.sender.name}
                    </span>
                  </div>
                )}
                
                <div className={`relative px-4 py-2 rounded-2xl ${
                  msg.sender.id === user?.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}>
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender.id === user?.id
                      ? 'text-blue-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                  
                  {msg.sender.id === user?.id && (
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="absolute -left-8 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  dark:bg-gray-800 dark:border-gray-600 dark:text-white
                  dark:focus:ring-blue-400 dark:focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleFileUpload}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            variant="primary"
            size="sm"
            className="p-3"
          >
            {sending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            // Handle file upload
            console.log('File selected:', e.target.files?.[0]);
          }}
        />
      </div>
    </div>
  );
};