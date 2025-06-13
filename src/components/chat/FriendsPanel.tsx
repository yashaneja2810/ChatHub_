import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  UserPlus, 
  Users, 
  MessageCircle, 
  Check, 
  X,
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { Profile } from '../../types/supabase';
import { useNavigate } from 'react-router-dom';

interface Friend {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  is_online?: boolean;
  last_seen?: string;
  created_at?: string;
  status?: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender: Profile;
  receiver: Profile;
}

interface ChatMember {
  chat_id: string;
  chats: {
    type: 'direct' | 'group';
  };
}

interface FriendsPanelProps {
  onClose: () => void;
  onStartChat: (chatId: string) => void;
}

interface User {
  id: string;
  email?: string;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({
  onClose,
  onStartChat,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth() as { user: User | null };
  const navigate = useNavigate();

  const fetchFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('friendships')
        .select(`
          user1_id,
          user2_id,
          user1:profiles!friendships_user1_id_fkey (id, full_name, username, avatar_url, is_online, last_seen),
          user2:profiles!friendships_user2_id_fkey (id, full_name, username, avatar_url, is_online, last_seen)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      const friendsList = data?.map((friendship: any) => {
        const friend = friendship.user1_id === user.id ? friendship.user2 : friendship.user1;
        return {
          id: friend.id,
          full_name: friend.full_name,
          username: friend.username,
          avatar_url: friend.avatar_url,
          is_online: friend.is_online,
          last_seen: friend.last_seen,
          status: friend.is_online ? 'online' : 'offline'
        };
      }) || [];

      setFriends(friendsList);
    } catch (error: any) {
      console.error('Error fetching friends:', error);
      setError('Failed to load friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      fetchFriends();
    }

    // Subscribe to online status changes
    const channel = supabase
      .channel('online_status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          if (mounted) {
    fetchFriends();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    fetchFriendRequests();
  }, [user]);

  useEffect(() => {
    if (searchQuery.length >= 3 && activeTab === 'add') {
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, activeTab]);

  // Real-time updates for friend requests
  useRealtime(
    'friend_requests',
    undefined,
    () => fetchFriendRequests(),
    () => fetchFriendRequests(),
    () => fetchFriendRequests()
  );

  // Real-time updates for friendships
  useRealtime(
    'friendships',
    undefined,
    () => fetchFriends(),
    () => fetchFriends(),
    () => fetchFriends()
  );

  const fetchFriendRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          sender:profiles!friend_requests_sender_id_fkey(*),
          receiver:profiles!friend_requests_receiver_id_fkey(*)
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setFriendRequests(requests || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      toast.error('Failed to load friend requests');
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_online, last_seen, created_at')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;
      
      // Filter out existing friends and pending requests
      const friendIds = friends.map(f => f.id);
      const requestIds = friendRequests.map(r => 
        r.sender_id === user.id ? r.receiver_id : r.sender_id
      );
      const excludeIds = [...friendIds, ...requestIds];
      const filteredResults = (data || []).filter(
        profile => !excludeIds.includes(profile.id)
      );

      setSearchResults(filteredResults as Friend[]);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.trim();
    setSearchQuery(query);
    if (query.length >= 3) {
      searchUsers(query);
    } else {
      setSearchResults([]);
    }
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if a friend request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingRequest) {
        toast.error('Friend request already exists');
        return;
      }

      // Check if they are already friends
      const { data: existingFriendship, error: friendshipError } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .single();

      if (friendshipError && friendshipError.code !== 'PGRST116') {
        throw friendshipError;
      }

      if (existingFriendship) {
        toast.error('You are already friends with this user');
        return;
      }

      // Send the friend request
      const { error } = await supabase
        .from('friend_requests')
        .insert([
          {
            sender_id: user.id,
            receiver_id: userId,
            status: 'pending'
          }
        ]);

      if (error) throw error;
      toast.success('Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First get the friend request details
      const { data: request, error: requestError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      if (!request) {
        toast.error('Friend request not found');
        return;
      }

      // Start a transaction
      const { error: transactionError } = await supabase.rpc('handle_friend_request', {
        p_request_id: requestId,
        p_accept: accept
      });

      if (transactionError) throw transactionError;

      if (accept) {
        toast.success('Friend request accepted!');
      } else {
        toast.success('Friend request rejected');
      }

      // Refresh the friends list and friend requests
      await Promise.all([
        fetchFriends(),
        fetchFriendRequests()
      ]);
    } catch (error) {
      console.error('Error responding to friend request:', error);
      toast.error('Failed to respond to friend request');
    }
  };

  const startChat = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to start a chat');
        return;
      }

      const { data: chatId, error } = await supabase
        .rpc('create_direct_chat', {
          p_user1_id: user.id,
          p_user2_id: userId
        });

      if (error) {
        console.error('Error starting chat:', error);
        toast.error('Failed to start chat');
        return;
      }

      if (chatId) {
        onStartChat(chatId);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
    }
  };

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

  const receivedRequests = friendRequests.filter(r => r.receiver_id === user?.id);
  const sentRequests = friendRequests.filter(r => r.sender_id === user?.id);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Friends
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
        
        {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('friends')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'friends'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
          Friends
          </button>
          <button
            onClick={() => setActiveTab('requests')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'requests'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
          Requests
          </button>
          <button
            onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'add'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Add Friends
          </button>
      </div>

      {/* Search Bar */}
      {activeTab === 'add' && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' && (
          <>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No friends yet. Add some friends to start chatting!
                </p>
                <Button
                  onClick={() => setActiveTab('add')}
                  variant="primary"
                  size="sm"
                >
                  Add Friends
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {friends.map((friend) => (
                  <button
                  key={friend.id}
                    onClick={() => startChat(friend.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-sm">
                              {friend.full_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                            friend.is_online
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {friend.full_name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {friend.is_online
                            ? 'Online'
                            : friend.last_seen
                            ? `Last seen ${new Date(
                                friend.last_seen
                              ).toLocaleTimeString()}`
                            : 'Offline'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                  </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {receivedRequests.length === 0 && sentRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                    No pending friend requests
                  </p>
              </div>
            ) : (
              <>
                {receivedRequests.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Received Requests
                    </h3>
                    {receivedRequests.map((request) => (
                      <div
                      key={request.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2"
                    >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            {request.sender.avatar_url ? (
                              <img
                                src={request.sender.avatar_url}
                                alt={request.sender.full_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {request.sender.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {request.sender.full_name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              @{request.sender.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => respondToFriendRequest(request.id, true)}
                            variant="primary"
                            size="sm"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => respondToFriendRequest(request.id, false)}
                            variant="danger"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

            {sentRequests.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Sent Requests
                </h3>
                  {sentRequests.map((request) => (
                    <div
                      key={request.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2"
                    >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            {request.receiver.avatar_url ? (
                              <img
                                src={request.receiver.avatar_url}
                                alt={request.receiver.full_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {request.receiver.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {request.receiver.full_name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              @{request.receiver.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {searching ? (
              <div className="flex items-center justify-center p-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery.length >= 3
                    ? 'No users found'
                    : 'Search for users to add as friends'}
                </p>
              </div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                        <span className="text-white font-bold text-sm">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                        )}
                      </div>
                      <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.full_name}
                        </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </p>
                    </div>
                    </div>
                    <Button
                      onClick={() => sendFriendRequest(user.id)}
                      variant="primary"
                      size="sm"
                    >
                    <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};