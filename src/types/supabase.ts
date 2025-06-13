export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_members: {
        Row: {
          id: string;
          chat_id: string;
          user_id: string;
          role: 'admin' | 'member';
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          user_id: string;
          role?: 'admin' | 'member';
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          user_id?: string;
          role?: 'admin' | 'member';
          created_at?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          type: 'direct' | 'group';
          name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'direct' | 'group';
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'direct' | 'group';
          name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          username: string;
          avatar_url: string | null;
          is_online: boolean;
          last_seen: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          username: string;
          avatar_url?: string | null;
          is_online?: boolean;
          last_seen?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          username?: string;
          avatar_url?: string | null;
          is_online?: boolean;
          last_seen?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never
    };
    Functions: {
      [_ in never]: never
    };
    Enums: {
      [_ in never]: never
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type ChatMember = Tables<'chat_members'>
export type Chat = Tables<'chats'>
export type Message = Tables<'messages'>
export type Profile = Tables<'profiles'>

export type ChatMemberWithChat = {
  chat_id: string;
  chats: Chat;
};

export type MessageWithProfile = {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  profiles: {
    full_name: string;
  } | null;
};

export type ChatMemberWithProfile = {
  user_id: string;
  profiles: {
    full_name: string;
    username: string;
    is_online: boolean;
    avatar_url: string | null;
  } | null;
}; 