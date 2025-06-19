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
import './MessageBubble.css';

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
  onSelectChat?: (chatId: string) => void;
}

// --- URL detection utility ---
const urlRegex = /((https?:\/\/|www\.)[\w-]+(\.[\w-]+)+(\/[\w-./?%&=]*)?)/gi;

function extractUrls(text: string): string[] {
  return (text.match(urlRegex) || []).map(url => {
    if (!/^https?:\/\//i.test(url)) return 'https://' + url;
    return url;
  });
}

function linkify(text: string) {
  let i = 0;
  return text.replace(urlRegex, (url) => {
    let href = url;
    if (!/^https?:\/\//i.test(url)) href = 'https://' + url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline break-all">${url}</a>`;
  });
}

// --- LinkPreview component ---
const LinkPreview: React.FC<{ url: string }> = ({ url }) => {
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      setLoading(true);
      setError(null);
      try {
        // Use a public Open Graph API proxy (for demo; in production, use your own serverless function)
        const res = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Failed to fetch preview');
        const data = await res.json();
        if (!cancelled) setMeta(data);
      } catch (e: any) {
        if (!cancelled) setError('No preview available');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMeta();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <div className="mt-2 text-xs text-gray-400">Loading preview...</div>;
  if (error || !meta) return null;

  return (
    <a href={meta.url || url} target="_blank" rel="noopener noreferrer" className="block mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-black/80 shadow hover:shadow-lg transition overflow-hidden">
      {meta.images && meta.images[0] && (
        <img src={meta.images[0]} alt={meta.title || meta.url} className="w-full h-32 object-cover" />
      )}
      <div className="p-3">
        <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{meta.title || meta.url}</div>
        {meta.description && <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{meta.description}</div>}
        <div className="text-xs text-blue-500 mt-1">{meta.domain || (meta.url || url).replace(/^https?:\/\//, '').split('/')[0]}</div>
      </div>
    </a>
  );
};

// Friend type for forward modal
interface FriendForForward {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

// --- Forward Modal ---
const ForwardModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  friends: FriendForForward[];
  onForward: (friend: FriendForForward) => void;
}> = ({ isOpen, onClose, messages, friends, onForward }) => {
  if (!isOpen || !messages || messages.length === 0) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Forward Messages">
      <div className="mb-4 text-gray-700 dark:text-gray-200">Select a friend to forward {messages.length > 1 ? `${messages.length} messages` : 'this message'}:</div>
      <div className="max-h-64 overflow-y-auto space-y-2">
        {friends.map(friend => (
          <button
            key={friend.id}
            onClick={() => onForward(friend)}
            className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-800 transition"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 dark:from-purple-900 dark:via-blue-900 dark:to-black flex items-center justify-center">
              {friend.avatar_url ? (
                <img src={friend.avatar_url} alt={friend.full_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Users className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium text-gray-900 dark:text-white truncate">{friend.full_name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">@{friend.username}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, onBack, onShowFriends, onSelectChat }) => {
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
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardMessages, setForwardMessages] = useState<Message[]>([]);
  const [friendsForForward, setFriendsForForward] = useState<FriendForForward[]>([]);
  const [selectedForForward, setSelectedForForward] = useState<string | null>(null);

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
    longPressTimeout.current = setTimeout(() => {
      setSelectionMode(true);
      setSelectedMessages([messageId]);
      setSelectedForForward(messageId);
    }, 500);
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
    setSelectedForForward(null);
  };
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages([]);
    setSelectedForForward(null);
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

  // Fetch friends for forwarding
  useEffect(() => {
    if (!user) return;
    async function fetchFriends() {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          user1_id,
          user2_id,
          user1:profiles!friendships_user1_id_fkey (id, full_name, username, avatar_url),
          user2:profiles!friendships_user2_id_fkey (id, full_name, username, avatar_url)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      if (!error && data) {
        const friendsList: FriendForForward[] = data.map((friendship: any) => {
          const friend = friendship.user1_id === user.id ? friendship.user2 : friendship.user1;
          return {
            id: friend.id,
            full_name: friend.full_name,
            username: friend.username,
            avatar_url: friend.avatar_url,
          };
        });
        setFriendsForForward(friendsList);
      }
    }
    fetchFriends();
  }, [user]);

  // Forward handler: create/find direct chat, then send message
  const handleForwardToFriend = async (friend: FriendForForward) => {
    if (!forwardMessages || forwardMessages.length === 0 || !user) return;
    let chatId: string | null = null;
    const { data: chats, error: chatError } = await supabase
      .from('chats')
      .select('id, type, chat_members!inner(user_id)')
      .eq('type', 'direct');
    if (!chatError && chats) {
      for (const chat of chats) {
        const memberIds = chat.chat_members.map((m: any) => m.user_id);
        if (memberIds.includes(user.id) && memberIds.includes(friend.id) && memberIds.length === 2) {
          chatId = chat.id;
          break;
        }
      }
    }
    if (!chatId) {
      const { data: newChat, error: createError } = await supabase.rpc('create_direct_chat', {
        p_user1_id: user.id,
        p_user2_id: friend.id
      });
      if (createError) {
        toast.error('Failed to create chat');
        return;
      }
      chatId = newChat;
    }
    // Forward all selected messages in order
    await Promise.all(forwardMessages.map(msg =>
      supabase.from('messages').insert([
        {
          chat_id: chatId,
          sender_id: user.id,
          content: msg.content,
          type: msg.type || 'text',
        },
      ])
    ));
    setForwardModalOpen(false);
    setForwardMessages([]);
    setSelectionMode(false);
    setSelectedMessages([]);
    setSelectedForForward(null);
    toast.success('Messages forwarded!');
    // Open the chat programmatically if handler is available
    if (typeof onSelectChat === 'function' && chatId) {
      onSelectChat(chatId);
    } else if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.hash = `#chat-${chatId}`;
        window.location.reload();
      }, 300);
    }
  };

  // Allow forwarding for both sent and received messages
  const canForward = true;

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
        className="h-14 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-purple-900 dark:via-blue-900 dark:to-black flex items-center px-2 sm:px-4 rounded-t-none sm:rounded-t-2xl shadow-none sm:shadow-xl sticky top-0 z-30"
        style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)' }}
      >
        <button
          onClick={onBack}
          className="lg:hidden p-1 -ml-1 mr-2 text-white hover:text-gray-200 bg-white/10 rounded-full backdrop-blur"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-shrink-0 mr-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 dark:from-purple-900 dark:via-blue-900 dark:to-black p-0.5 animate-pulse">
              <Avatar
                src={chatInfo?.other_user?.avatar_url}
                name={chatInfo?.other_user?.full_name || 'User'}
                size="sm"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate drop-shadow-lg">
              {chatInfo?.other_user?.full_name || 'Loading...'}
            </h2>
          </div>
        </div>
        {/* Forward and Delete buttons in header when messages are selected */}
        {selectionMode && selectedMessages.length > 0 && (
          <div className="flex items-center ml-4 space-x-4">
            {/* Forward button */}
            <button
              className="p-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 shadow transition-all duration-200 z-10"
              onClick={() => {
                const msgs = messages.filter(m => selectedMessages.includes(m.id));
                if (msgs.length > 0) {
                  setForwardMessages(msgs);
                  setForwardModalOpen(true);
                }
              }}
              title="Forward selected messages"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0l6-6m-6 6l6 6m6-6h6" />
              </svg>
            </button>
            {/* Delete button (only if all selected messages are sent by the current user) */}
            {selectedMessages.every(id => messages.find(m => m.id === id)?.sender_id === user?.id) && (
              <button
                className="p-2 rounded-md bg-red-500 text-white hover:bg-red-600 shadow transition-all duration-200 z-10"
                onClick={handleDeleteSelected}
                title="Delete selected messages"
              >
                {/* Trash bin icon */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            )}
            {/* Cancel button */}
            <button
              className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 shadow transition-all duration-200 z-10"
              onClick={handleCancelSelection}
              title="Cancel selection"
            >
              <svg width="18" height="18" viewBox="0 0 20 20"><line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/><line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </div>
        )}
      </motion.div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 space-y-2" style={{ paddingTop: '3.5rem' }}>
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
                    className={`max-w-[95vw] sm:max-w-[80vw] rounded-2xl sm:rounded-3xl px-2 sm:px-4 py-2 relative shadow-xl transition-all duration-200 group
                      ${isOwn
                        ? isSelected
                          ? 'bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white ring-2 ring-pink-400 animate-glow'
                          : 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white dark:text-white/90 backdrop-blur-2xl border border-blue-200/30 dark:border-blue-900/30'
                        : isSelected
                          ? 'bg-white/80 dark:bg-gray-900/80 text-gray-900 dark:text-white border-2 border-pink-400 animate-glow'
                          : 'bg-white/70 dark:bg-black/70 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 backdrop-blur-2xl'
                      } hover:scale-[1.03] hover:shadow-2xl`}
                    style={{ boxShadow: isSelected ? '0 0 8px 2px #f472b6, 0 4px 32px 0 rgba(31,38,135,0.18)' : '0 2px 16px 0 rgba(31,38,135,0.10)' }}
                  >
                    {/* Forward button (visible for all messages, not just own) */}
                    {((selectionMode && isSelected) || !selectionMode) && (
                      <button
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/80 dark:bg-black/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500 dark:text-purple-400 shadow transition-all duration-200 z-10"
                        style={{ display: selectionMode ? (isSelected ? 'block' : 'none') : 'none' }}
                        title="Forward message"
                        onClick={(e) => { e.stopPropagation(); setForwardMessages([message]); setForwardModalOpen(true); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0l6-6m-6 6l6 6m6-6h6" />
                        </svg>
                      </button>
                    )}
                    {/* Forward button on hover (desktop) */}
                    {!selectionMode && (
                      <button
                        className="absolute top-1 right-1 p-1 rounded-full bg-white/80 dark:bg-black/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500 dark:text-purple-400 shadow transition-all duration-200 z-10 hidden group-hover:block"
                        title="Forward message"
                        onClick={(e) => { e.stopPropagation(); setForwardMessages([message]); setForwardModalOpen(true); }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0l6-6m-6 6l6 6m6-6h6" />
                        </svg>
                      </button>
                    )}
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
                        className="max-w-[60vw] sm:max-w-[120px] max-h-24 rounded-md object-cover mb-1 border border-gray-200 dark:border-gray-700 cursor-pointer"
                        style={{ display: 'block' }}
                        onClick={() => handleOpenMedia(message.content, 'image')}
                      />
                    ) : message.type === 'video' ? (
                      <video
                        src={message.content}
                        controls
                        className="max-w-[60vw] sm:max-w-[120px] max-h-24 rounded-md mb-1 border border-gray-200 dark:border-gray-700 cursor-pointer"
                        style={{ display: 'block' }}
                        onClick={() => handleOpenMedia(message.content, 'video')}
                      />
                    ) : (
                      (() => {
                        const urls = extractUrls(message.content);
                        if (urls.length > 0) {
                          return (
                            <>
                              <div className="text-sm leading-snug animate-fade-in break-words" dangerouslySetInnerHTML={{ __html: linkify(message.content) }} />
                              <LinkPreview url={urls[0]} />
                            </>
                          );
                        } else {
                          return (
                            <p className="text-sm leading-snug animate-fade-in break-words">{message.content}</p>
                          );
                        }
                      })()
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

      {/* Input */}
      <div className="p-2 sm:p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-20">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-1 bg-white/70 dark:bg-black/70 rounded-full text-blue-500 dark:text-purple-400 hover:bg-blue-100 dark:hover:bg-purple-900 shadow transition-all duration-200"
            disabled={uploadingImage}
            title="Send image or video"
          >
            <ImageIcon className="h-4 w-4" />
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
            className="flex-1 p-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Forward Modal */}
      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => setForwardModalOpen(false)}
        messages={forwardMessages}
        friends={friendsForForward}
        onForward={handleForwardToFriend}
      />
    </div>
  );
};