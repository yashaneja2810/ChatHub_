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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Chat</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chats Panel */}
        <AnimatePresence mode="wait">
          {(!selectedChat || window.innerWidth >= 1024) && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`
                fixed lg:relative inset-y-0 left-0 z-20
                w-full lg:w-80 h-[calc(100vh-3.5rem)]
                bg-white dark:bg-gray-800
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
                fixed lg:relative inset-0 z-10
                w-full h-[calc(100vh-3.5rem)]
                bg-white dark:bg-gray-800
                ${!selectedChat ? 'hidden lg:block' : 'block'}
              `}
            >
              <ChatWindow
                chatId={selectedChat}
                onBack={() => setSelectedChat(null)}
                onShowFriends={() => setShowFriendsPanel(true)}
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
            <SettingsPanel />
          </motion.div>
        )}
      </div>
    </div>
  );
};