import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Users, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { FriendsPanel } from './FriendsPanel';
import { SettingsPanel } from './SettingsPanel';
import { LoadingSpinner } from '../ui/LoadingSpinner';

type View = 'chats' | 'friends' | 'settings';

export const ChatLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('chats');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleStartChat = (chatId: string) => {
    setSelectedChat(chatId);
    setCurrentView('chats');
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chat App</h1>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          {/* User Profile */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {user?.user_metadata?.full_name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.user_metadata?.full_name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  @{user?.user_metadata?.username}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex space-x-1 mt-4">
            <button
              onClick={() => setCurrentView('chats')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'chats'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Chats
            </button>
            <button
              onClick={() => setCurrentView('friends')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'friends'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Friends
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'settings'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chats Panel */}
          <div className={`w-80 border-r border-gray-200 dark:border-gray-800 ${currentView === 'chats' ? 'block' : 'hidden'}`}>
            <ChatSidebar
              onSelectChat={setSelectedChat}
              selectedChatId={selectedChat}
              onShowFriends={() => setShowFriendsPanel(true)}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            {currentView === 'friends' && (
              <FriendsPanel
                onClose={() => setCurrentView('chats')}
                onStartChat={handleStartChat}
              />
            )}
            {currentView === 'settings' && <SettingsPanel />}
            {currentView === 'chats' && selectedChat && (
              <ChatWindow 
                chatId={selectedChat} 
                onBack={() => setSelectedChat(null)}
                onShowFriends={() => setShowFriendsPanel(true)}
              />
            )}
          </div>
        </div>

        {/* Friends Panel Overlay */}
        {showFriendsPanel && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 shadow-lg"
          >
            <FriendsPanel
              onClose={() => setShowFriendsPanel(false)}
              onStartChat={handleStartChat}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};