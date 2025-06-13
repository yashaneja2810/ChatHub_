import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Chat, ChatMember } from '../../types/chat';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../types/supabase';

type ChatRow = Database['public']['Tables']['chats']['Row'];
type ChatMemberRow = Database['public']['Tables']['chat_members']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onShowFriends: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  selectedChatId,
  onSelectChat,
  onShowFriends,
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    let messageChannel: any = null;
    let chatChannel: any = null;

    const fetchChats = async () => {
      try {
        setError(null);
        
        // Don't fetch if user is not loaded yet
        if (!user?.id) {
          return;
        }

        // First get all chats the user is a member of
        const { data: chats, error: chatsError } = await supabase
          .from('chats')
          .select(`
            *,
            chat_members!inner (
              user_id,
              role,
              profiles (
                id,
                full_name,
                username,
                avatar_url,
                is_online,
                last_seen
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (chatsError) throw chatsError;
        if (!chats) return;

        // Get last messages for all chats
        const { data: lastMessages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .in('chat_id', chats.map(chat => chat.id))
          .order('created_at', { ascending: false });

        if (messagesError) throw messagesError;

        // Process chats with last messages
        const processedChats = chats.map(chat => {
          const lastMessage = lastMessages?.find(msg => msg.chat_id === chat.id);
          const otherUser = chat.chat_members
            .find((member: ChatMemberRow & { profiles: ProfileRow }) => member.user_id !== user.id)
            ?.profiles;

          return {
            id: chat.id,
            type: chat.type,
            name: chat.name,
            avatar_url: chat.avatar_url,
            created_at: chat.created_at,
            role: chat.chat_members.find((m: ChatMemberRow) => m.user_id === user.id)?.role,
            last_message: lastMessage ? {
              id: lastMessage.id,
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              sender_id: lastMessage.sender_id,
              sender: chat.chat_members
                .find((m: ChatMemberRow & { profiles: ProfileRow }) => m.user_id === lastMessage.sender_id)
                ?.profiles
            } : null,
            other_user: otherUser ? {
              id: otherUser.id,
              full_name: otherUser.full_name,
              username: otherUser.username,
              avatar_url: otherUser.avatar_url,
              is_online: otherUser.is_online,
              last_seen: otherUser.last_seen
            } : undefined,
            members: chat.chat_members.map((m: ChatMemberRow & { profiles: ProfileRow }) => ({
              user_id: m.user_id,
              role: m.role,
              full_name: m.profiles.full_name,
              username: m.profiles.username,
              avatar_url: m.profiles.avatar_url,
              is_online: m.profiles.is_online,
              last_seen: m.profiles.last_seen
            }))
          } as Chat;
        });

        if (mounted) {
          setChats(processedChats);
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch chats');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const setupRealtimeSubscriptions = () => {
      // Subscribe to new messages
      messageChannel = supabase
        .channel('messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            if (mounted) {
              fetchChats();
            }
          }
        )
        .subscribe();

      // Subscribe to chat member changes
      chatChannel = supabase
        .channel('chat_members')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_members',
          },
          () => {
            if (mounted) {
              fetchChats();
            }
          }
        )
        .subscribe();
    };

    fetchChats();
    setupRealtimeSubscriptions();

    return () => {
      mounted = false;
      if (messageChannel) {
        messageChannel.unsubscribe();
      }
      if (chatChannel) {
        chatChannel.unsubscribe();
      }
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
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
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chats
        </h2>
        <Button
          onClick={onShowFriends}
          variant="ghost"
          size="sm"
          className="p-2"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No chats yet. Start a conversation!
            </p>
            <Button
              onClick={onShowFriends}
              variant="primary"
              size="sm"
            >
              Find Friends
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full p-4 flex items-center space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedChatId === chat.id
                    ? 'bg-gray-50 dark:bg-gray-800'
                    : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {chat.avatar_url ? (
                    <img
                      src={chat.avatar_url}
                      alt={chat.name || 'Chat'}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {chat.name?.charAt(0)?.toUpperCase() || 'C'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {chat.name || chat.other_user?.full_name || 'Unnamed Chat'}
                    </p>
                    {chat.last_message && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(chat.last_message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  {chat.last_message && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {chat.last_message.content}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};