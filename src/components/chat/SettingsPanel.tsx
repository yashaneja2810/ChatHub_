import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Edit3, 
  Camera, 
  Bell, 
  Shield, 
  Palette,
  Globe,
  HelpCircle,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'privacy' | 'appearance'>('profile');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    bio: '',
  });
  const { profile, updateProfile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  React.useEffect(() => {
    if (profile) {
      setProfileData({
        fullName: profile.full_name,
        bio: profile.bio,
      });
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await updateProfile({
        full_name: profileData.fullName,
        bio: profileData.bio,
      });

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

  const handleSignOut = async () => {
    await signOut();
  };

  const settingSections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              profile?.full_name?.charAt(0)?.toUpperCase()
            )}
          </div>
          <button className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Camera className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {profile?.full_name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          @{profile?.username}
        </p>
      </div>

      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <Input
          label="Full Name"
          value={profileData.fullName}
          onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
          placeholder="Enter your full name"
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio
          </label>
          <textarea
            value={profileData.bio}
            onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Tell us about yourself..."
            maxLength={160}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              dark:bg-black dark:border-gray-600 dark:text-white
              dark:focus:ring-blue-400 dark:focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
            {profileData.bio.length}/160
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full"
        >
          <Edit3 className="mr-2 h-4 w-4" />
          Update Profile
        </Button>
      </form>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Notification Settings
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Message Notifications</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when you receive new messages</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Friend Requests</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when someone sends you a friend request</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Group Invitations</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when you're invited to a group</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Privacy Settings
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Online Status</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Show when you're online to your friends</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Last Seen</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Show when you were last active</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Profile Visibility</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Allow others to find you by username</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Appearance Settings
      </h3>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Theme</h4>
          <div className="flex space-x-3">
            <button
              onClick={() => theme === 'dark' && toggleTheme()}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-8 h-8 bg-white border border-gray-300 rounded mx-auto mb-2"></div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Light</p>
            </button>
            <button
              onClick={() => theme === 'light' && toggleTheme()}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-8 h-8 bg-gray-900 rounded mx-auto mb-2"></div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark</p>
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Language</h4>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:border-gray-600 dark:text-white">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'privacy':
        return renderPrivacySection();
      case 'appearance':
        return renderAppearanceSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className="h-full flex flex-col w-full">
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>
        </div>
      </div>
      {/* Mobile Navigation */}
      <div className="lg:hidden border-b border-gray-200 dark:border-gray-800">
        <div className="flex overflow-x-auto hide-scrollbar">
          {settingSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap ${
                  activeSection === section.id
                    ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 flex bg-gray-50 dark:bg-black w-full h-full">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Settings
            </h2>
            <nav className="space-y-1">
              {settingSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as any)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {section.label}
                  </button>
                );
              })}
              
              <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                  <Globe className="mr-3 h-4 w-4" />
                  Language
                </button>
                <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                  <HelpCircle className="mr-3 h-4 w-4" />
                  Help & Support
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto w-full max-w-full">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-full sm:max-w-2xl mx-auto"
          >
            {renderContent()}
          </motion.div>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex justify-around p-2">
          <button
            onClick={handleSignOut}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </button>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            <HelpCircle className="mr-2 h-4 w-4" />
            Help
          </button>
        </div>
      </div>
    </div>
  );
};