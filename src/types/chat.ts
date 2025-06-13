export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface ChatMember {
  user_id: string;
  role: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface Chat {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  created_at: string;
  updated_at: string;
  role?: string;
  members?: ChatMember[];
  member_count?: number;
  last_message?: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    sender?: {
      id: string;
      full_name: string;
      username: string;
      avatar_url: string;
    };
  };
  other_user?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string;
    is_online: boolean;
    last_seen: string;
  };
  unread_count: number;
} 