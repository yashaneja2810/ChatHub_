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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-black dark:via-gray-900 dark:to-black px-2 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs sm:max-w-md space-y-8"
      >
        <div className="bg-white/70 dark:bg-black/80 backdrop-blur-2xl rounded-3xl shadow-2xl p-4 sm:p-10">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto h-28 w-28 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 dark:from-purple-900 dark:via-blue-900 dark:to-black rounded-full flex items-center justify-center mb-4 relative shadow-xl animate-pulse"
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover border-4 border-white/60 dark:border-black/60"
                />
              ) : (
                <User className="h-14 w-14 text-white" />
              )}
              <button className="absolute -bottom-2 -right-2 bg-white/80 dark:bg-black/80 rounded-full p-2 shadow-lg border border-gray-200 dark:border-gray-700">
                <Camera className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </motion.div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Complete Your Profile
            </h2>
            <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
              Tell others a bit about yourself
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <Input
                label="Full Name"
                value={profile.full_name}
                disabled
                className="bg-white/80 dark:bg-black/80 rounded-full shadow-md"
              />
              <Input
                label="Username"
                value={`@${profile.username}`}
                disabled
                className="bg-white/80 dark:bg-black/80 rounded-full shadow-md"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl shadow-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent dark:bg-black/80 dark:border-gray-700 dark:text-white dark:focus:ring-purple-500 dark:focus:border-transparent transition-all duration-200"
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
              className="w-full rounded-full shadow-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-purple-900 dark:via-blue-900 dark:to-black animate-pulse"
            >
              <Edit3 className="mr-2 h-5 w-5" />
              Update Profile
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};