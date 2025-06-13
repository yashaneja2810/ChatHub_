import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useTyping = (chatId: string, userId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<any>();

  useEffect(() => {
    if (!chatId || !userId) return;

    const channel = supabase.channel(`typing-${chatId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = Object.keys(state)
          .filter(key => key !== userId && state[key][0]?.typing)
          .map(key => state[key][0]?.user_id)
          .filter(Boolean);
        setTypingUsers(typing);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [chatId, userId]);

  const startTyping = () => {
    if (!channelRef.current) return;

    channelRef.current.track({
      user_id: userId,
      typing: true,
      timestamp: Date.now(),
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (!channelRef.current) return;

    channelRef.current.track({
      user_id: userId,
      typing: false,
      timestamp: Date.now(),
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  return { typingUsers, startTyping, stopTyping };
};