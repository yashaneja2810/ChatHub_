import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Users, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { FriendsPanel } from './FriendsPanel';
import { SettingsPanel } from './SettingsPanel';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export const ChatLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<'chats' | 'friends' | 'settings'>('chats');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleStartChat = (userId: string) => {
    setShowFriendsPanel(false);
    setCurrentView('chats');
    // Additional logic to start chat with user
  };

  return (
    <div className="h-screen min-h-0 min-w-0 flex flex-col bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-black dark:via-gray-900 dark:to-black text-sm">
      {/* Header removed */}
      {/* Main Content */}
      <div
        className="flex-1 min-h-0 min-w-0 flex overflow-hidden
          m-0 rounded-none shadow-none
          sm:m-1 sm:rounded-lg sm:shadow-lg
          md:m-2 md:rounded-xl md:shadow-xl
          lg:m-4 lg:rounded-2xl lg:shadow-2xl
          bg-white/70 dark:bg-black/80 backdrop-blur-2xl mt-0 relative"
      >
        {/* Chats Panel */}
        <AnimatePresence mode="wait">
          {(!selectedChat || window.innerWidth >= 1024) && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`
                lg:relative
                w-full min-w-0 h-full min-h-0
                bg-white/60 dark:bg-black/80
                border-r border-gray-200 dark:border-gray-700
                ${selectedChat ? 'hidden lg:block' : 'block'}
              `}
            >
              <ChatSidebar
                onSelectChat={setSelectedChat}
                selectedChatId={selectedChat}
                onShowFriends={() => setShowFriendsPanel(true)}
                onShowSettings={() => setCurrentView('settings')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Window */}
        <AnimatePresence mode="wait">
          {selectedChat && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`
                lg:relative
                w-full min-w-0 h-full min-h-0
                bg-white/60 dark:bg-black/80
                ${!selectedChat ? 'hidden lg:block' : 'block'}
              `}
            >
              <ChatWindow
                chatId={selectedChat}
                onBack={() => setSelectedChat(null)}
                onShowFriends={() => setShowFriendsPanel(true)}
                onSelectChat={setSelectedChat}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Friends Panel */}
        <AnimatePresence>
          {showFriendsPanel && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-0 z-30 bg-white dark:bg-gray-800"
            >
              <FriendsPanel
                onClose={() => setShowFriendsPanel(false)}
                onStartChat={handleStartChat}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Panel */}
        {currentView === 'settings' && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-30 bg-white dark:bg-gray-800"
          >
            <SettingsPanel onClose={() => setCurrentView('chats')} />
          </motion.div>
        )}
      </div>
    </div>
  );
};