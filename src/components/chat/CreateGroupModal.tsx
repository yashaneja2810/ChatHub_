import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Search, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface Friend {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const [step, setStep] = useState<'details' | 'members'>('details');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && step === 'members') {
      fetchFriends();
    }
  }, [isOpen, step]);

  const fetchFriends = async () => {
    if (!user) return;

    setLoadingFriends(true);
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          user1_id,
          user2_id,
          user1:profiles!friendships_user1_id_fkey (id, full_name, username, avatar_url),
          user2:profiles!friendships_user2_id_fkey (id, full_name, username, avatar_url)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (error) throw error;

      const friendsList: Friend[] = data?.map((friendship: any) => {
        const friend = friendship.user1_id === user.id ? friendship.user2 : friendship.user1;
        return {
          id: friend.id,
          full_name: friend.full_name,
          username: friend.username,
          avatar_url: friend.avatar_url,
        };
      }) || [];

      setFriends(friendsList);
    } catch (error) {
      console.error('Error fetching friends:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleNext = () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    setStep('members');
  };

  const handleBack = () => {
    setStep('details');
  };

  const createGroup = async () => {
    if (!user || !groupName.trim()) return;

    if (selectedFriends.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    if (selectedFriends.length > 19) {
      toast.error('Maximum 20 members allowed (including yourself)');
      return;
    }

    setLoading(true);

    try {
      // Create the group chat
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'group',
          name: groupName,
          description: groupDescription,
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add creator as admin
      const { error: adminError } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chat.id,
          user_id: user.id,
          role: 'admin',
        });

      if (adminError) throw adminError;

      // Send invitations to selected friends
      const invitations = selectedFriends.map(friendId => ({
        chat_id: chat.id,
        inviter_id: user.id,
        invitee_id: friendId,
      }));

      const { error: invitationError } = await supabase
        .from('group_invitations')
        .insert(invitations);

      if (invitationError) throw invitationError;

      toast.success('Group created and invitations sent!');
      onGroupCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('details');
    setGroupName('');
    setGroupDescription('');
    setSelectedFriends([]);
    setSearchQuery('');
    onClose();
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const filteredFriends = friends.filter(friend =>
    friend.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Group" size="md">
      {step === 'details' ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-10 w-10 text-white" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Create a group to chat with multiple friends
            </p>
          </div>

          <div className="space-y-4">
            <Input
              label="Group Name"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (Optional)
              </label>
              <textarea
                placeholder="What's this group about?"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  dark:bg-black dark:border-gray-600 dark:text-white
                  dark:focus:ring-blue-400 dark:focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                {groupDescription.length}/160
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button onClick={handleClose} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleNext} variant="primary">
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Members
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select friends to invite ({selectedFriends.length}/19)
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loadingFriends ? (
              <div className="text-center py-8">
                <LoadingSpinner />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  {friends.length === 0 ? 'No friends to add' : 'No friends found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFriends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    whileHover={{ x: 2 }}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedFriends.includes(friend.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                          {friend.avatar_url ? (
                            <img
                              src={friend.avatar_url}
                              alt={friend.full_name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          
                          ) : (
                            friend.full_name?.charAt(0)?.toUpperCase()
                          )}
                        </div>
                        {selectedFriends.includes(friend.id) && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <Plus className="h-3 w-3 text-white rotate-45" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {friend.full_name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button onClick={handleBack} variant="secondary">
              Back
            </Button>
            <Button
              onClick={createGroup}
              variant="primary"
              loading={loading}
              disabled={selectedFriends.length === 0}
            >
              Create Group
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};