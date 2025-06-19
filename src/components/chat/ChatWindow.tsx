import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Users,
  Image as ImageIcon,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { useTyping } from '../../hooks/useTyping';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import { Database } from '../../types/supabase';
import { Input } from '../ui/Input';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

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
    avatar_url: string | null;
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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [typingUserNames, setTypingUserNames] = useState<{[key: string]: string}>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaModal, setMediaModal] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

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
            type,
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
                type: message.type,
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
            type,
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
                type: message.type,
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
                  type: payload.new.type,
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log('Message deleted:', payload);
          if (mounted) {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
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
      // Handle message deletion for both sender and receiver
      setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
    }
  );

  const fetchMessageWithSender = async (messageId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        type,
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
          type: message.type,
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

      if (!members || members.length === 0) {
        console.error('No members found for chat:', chatId);
        throw new Error('No members found in chat');
      }

      const typedMembers = members as unknown as ChatMember[];

      if (chat.type === 'direct') {
        // Find the other user in the chat
        const otherMember = typedMembers.find(m => m.user_id !== user?.id);
        
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
            avatar_url: otherMember.profiles.avatar_url
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
      // Clear typing status when sending message
      updateTypingStatus(false);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing status to true
    updateTypingStatus(true);

    // Set a timeout to set typing status to false after 3 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
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
      // Remove the message from the local state
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
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

  // Subscribe to typing status changes
  useEffect(() => {
    const typingChannel = supabase
      .channel(`typing:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload: any) => {
          console.log('Typing status update:', payload);
          if (payload.new && payload.new.user_id !== user?.id) {
            if (payload.new.is_typing) {
              setTypingUsers(prev => [...new Set([...prev, payload.new.user_id])]);
            } else {
              setTypingUsers(prev => prev.filter(id => id !== payload.new.user_id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      typingChannel.unsubscribe();
    };
  }, [chatId, user?.id]);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!user) return;
    
    try {
      console.log('Updating typing status:', { chatId, isTyping });
      const { error } = await supabase.rpc('update_typing_status', {
        p_chat_id: chatId,
        p_is_typing: isTyping
      });

      if (error) {
        console.error('Error updating typing status:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  // Helper: handle long press or right click
  const handleMessageMouseDown = (messageId: string, isOwn: boolean) => {
    if (!isOwn) return;
    longPressTimeout.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedMessages([messageId]);
    }, 500); // 500ms for long press
  };
  const handleMessageMouseUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };
  const handleMessageContextMenu = (e: React.MouseEvent, messageId: string, isOwn: boolean) => {
    if (!isOwn) return;
    e.preventDefault();
    setSelectionMode(true);
    setSelectedMessages([messageId]);
  };
  const handleSelectMessage = (messageId: string) => {
    setSelectedMessages((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };
  const handleDeleteSelected = async () => {
    for (const id of selectedMessages) {
      await deleteMessage(id);
    }
    setSelectedMessages([]);
    setSelectionMode(false);
  };
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
  };

  const handleHeaderMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast.error('Only images and videos are supported');
        setUploadingImage(false);
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
      console.error('Error uploading media:', error);
      toast.error('Failed to send file');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleOpenMedia = (url: string, type: 'image' | 'video') => {
    setMediaModal({ url, type });
  };
  const handleCloseMedia = () => setMediaModal(null);
  const handleDownloadMedia = () => {
    if (!mediaModal) return;
    const link = document.createElement('a');
    link.href = mediaModal.url;
    link.download = mediaModal.url.split('/').pop() || 'media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="flex flex-col min-w-0 min-h-0 h-full bg-white/60 dark:bg-black/80 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-purple-900 dark:via-blue-900 dark:to-black flex items-center px-4 sm:px-8 rounded-t-none sm:rounded-t-2xl shadow-none sm:shadow-xl relative z-10"
        style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}
      >
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 mr-4 text-white hover:text-gray-200 bg-white/10 rounded-full backdrop-blur"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-shrink-0 mr-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 dark:from-purple-900 dark:via-blue-900 dark:to-black p-1 animate-pulse">
            <Avatar
              src={chatInfo?.other_user?.avatar_url}
              name={chatInfo?.other_user?.full_name || 'User'}
              size="md"
            />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate drop-shadow-lg">
              {chatInfo?.other_user?.full_name || 'Loading...'}
            </h2>
          </div>
        </div>
      </motion.div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full">
            <p className="text-red-500">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const isSelected = selectedMessages.includes(message.id);
            const showDate = index === 0 || !isSameDay(new Date(message.created_at), new Date(messages[index - 1].created_at));
            
            return (
              <React.Fragment key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <div className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
                      {format(new Date(message.created_at), 'MMMM d, yyyy')}
                    </div>
                  </div>
                )}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  onMouseDown={() => handleMessageMouseDown(message.id, isOwn)}
                  onMouseUp={handleMessageMouseUp}
                  onMouseLeave={handleMessageMouseUp}
                  onContextMenu={(e) => handleMessageContextMenu(e, message.id, isOwn)}
          >
            <div
                    className={`max-w-[95vw] sm:max-w-[70%] rounded-xl sm:rounded-2xl px-2 sm:px-3 py-2 relative transition-shadow duration-150 shadow-md backdrop-blur-lg ${
                      isOwn
                        ? isSelected
                          ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white ring-2 ring-pink-400'
                          : 'bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 text-white'
                        : 'bg-white/80 dark:bg-black/80 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800'
                    }`}
                    style={{ boxShadow: isSelected ? '0 0 0 2px #ef4444' : undefined }}
                  >
                    {selectionMode && isOwn && (
                      <button
                        className={`absolute -left-7 top-1 w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center ${isSelected ? 'bg-red-500' : 'bg-white'}`}
                        onClick={(e) => { e.stopPropagation(); handleSelectMessage(message.id); }}
                        tabIndex={0}
                        aria-label={isSelected ? 'Deselect message' : 'Select message'}
                      >
                        {isSelected ? (
                          <svg width="14" height="14" viewBox="0 0 20 20">
                            <polyline points="4 11 8 15 16 6" fill="none" stroke="white" strokeWidth="2"/>
                          </svg>
                        ) : null}
                      </button>
                    )}
                    {/* Message content rendering */}
                    {message.type === 'image' ? (
                      <img
                        src={message.content}
                        alt="sent media"
                        className="max-w-[70vw] sm:max-w-[180px] max-h-40 rounded-lg object-cover mb-1 border border-gray-200 dark:border-gray-700 cursor-pointer"
                        style={{ display: 'block' }}
                        onClick={() => handleOpenMedia(message.content, 'image')}
                      />
                    ) : message.type === 'video' ? (
                      <video
                        src={message.content}
                        controls
                        className="max-w-[70vw] sm:max-w-[180px] max-h-40 rounded-lg mb-1 border border-gray-200 dark:border-gray-700 cursor-pointer"
                        style={{ display: 'block' }}
                        onClick={() => handleOpenMedia(message.content, 'video')}
                      />
                    ) : (
                      <p className="text-sm leading-snug animate-fade-in break-words">{message.content}</p>
                    )}
                    <p className="text-xs mt-1 opacity-70 text-right">
                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 mt-4 animate-fade-in">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 animate-pulse delay-150" />
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 animate-pulse delay-300" />
          </div>
        )}
      </div>

      {/* Floating delete/cancel bar for selection mode */}
      {selectionMode && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full px-4 py-2 shadow-lg">
          <span className="text-sm text-gray-700 dark:text-gray-200">{selectedMessages.length} selected</span>
          <button
            className="ml-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 focus:outline-none"
            onClick={handleDeleteSelected}
            disabled={selectedMessages.length === 0}
            title="Delete selected messages"
          >
            <Trash2 size={18} />
          </button>
          <button
            className="ml-2 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
            onClick={handleCancelSelection}
            title="Cancel selection"
          >
            <svg width="18" height="18" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="2"/></svg>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-2 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-2 bg-white/70 dark:bg-black/70 rounded-full text-blue-500 dark:text-purple-400 hover:bg-blue-100 dark:hover:bg-purple-900 shadow transition-all duration-200"
            disabled={uploadingImage}
            title="Send image or video"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            type="file"
            accept="image/*,video/*"
            ref={imageInputRef}
            onChange={handleHeaderMediaChange}
            className="hidden"
          />
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={handleKeyPress}
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
      </div>

      {/* Media Modal */}
      {mediaModal && (
        <Modal isOpen={!!mediaModal} onClose={handleCloseMedia}>
          <div className="flex flex-col items-center justify-center p-4">
            {mediaModal.type === 'image' ? (
              <img src={mediaModal.url} alt="media" className="max-w-[90vw] max-h-[70vh] rounded-xl shadow-2xl" />
            ) : (
              <video src={mediaModal.url} controls autoPlay className="max-w-[90vw] max-h-[70vh] rounded-xl shadow-2xl" />
            )}
            <a
              href={mediaModal.url}
              download={mediaModal.url.split('/').pop() || 'media'}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-pink-500 text-white rounded-lg shadow hover:scale-105 transition text-center"
            >
              Download
            </a>
          </div>
        </Modal>
        )}
    </div>
  );
};