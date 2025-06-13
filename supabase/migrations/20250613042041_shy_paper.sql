/*
  # Chat and Messages Schema

  1. New Tables
    - `chats`
      - `id` (uuid, primary key)
      - `type` (text: direct, group)
      - `name` (text, for group chats)
      - `description` (text)
      - `avatar_url` (text)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `chat_members`
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references chats)
      - `user_id` (uuid, references profiles)
      - `role` (text: member, admin)
      - `joined_at` (timestamp)
    
    - `messages`
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references chats)
      - `sender_id` (uuid, references profiles)
      - `content` (text)
      - `message_type` (text: text, image, video, file)
      - `file_url` (text)
      - `file_name` (text)
      - `file_size` (bigint)
      - `reply_to` (uuid, references messages)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for chat access and message operations
*/

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct', 'group')),
  name text,
  description text DEFAULT '',
  avatar_url text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text DEFAULT '',
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'file')),
  file_url text,
  file_name text,
  file_size bigint,
  reply_to uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chat policies
CREATE POLICY "Users can view chats they are members of"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create group chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Chat members policies
CREATE POLICY "Users can view chat members for their chats"
  ON chat_members
  FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to chats they admin"
  ON chat_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    chat_id IN (
      SELECT chat_id FROM chat_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Messages policies
CREATE POLICY "Users can view messages in their chats"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their chats"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    chat_id IN (
      SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);