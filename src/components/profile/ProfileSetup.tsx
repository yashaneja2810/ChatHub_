import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Edit3, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import toast from 'react-hot-toast';

export const ProfileSetup: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await updateProfile({ bio });
      
      if (error) {
        toast.error('Failed to update profile');
      } else {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-black px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="bg-white dark:bg-black rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto h-24 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4 relative"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-white" />
              )}
              <button className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg border border-gray-200 dark:border-gray-600">
                <Camera className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Complete Your Profile
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Tell others a bit about yourself
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="Full Name"
                value={profile.full_name}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
              <Input
                label="Username"
                value={`@${profile.username}`}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  maxLength={160}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    dark:bg-black dark:border-gray-600 dark:text-white
                    dark:focus:ring-blue-400 dark:focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                  {bio.length}/160
                </p>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Update Profile
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};