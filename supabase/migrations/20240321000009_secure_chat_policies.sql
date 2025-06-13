-- Drop existing policies
DROP POLICY IF EXISTS "Users can view chats they are members of" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view their own memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can add members to their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can remove themselves from chats" ON chat_members;
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can add themselves to direct chats" ON chat_members;
DROP POLICY IF EXISTS "Users can remove themselves from chats" ON chat_members;
DROP POLICY IF EXISTS "Chat admins can manage members" ON chat_members;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their chats" ON messages;

-- Drop existing functions
DROP FUNCTION IF EXISTS is_chat_member(uuid, uuid);
DROP FUNCTION IF EXISTS is_chat_admin(uuid, uuid);
DROP FUNCTION IF EXISTS can_manage_chat(uuid, uuid);

-- Create secure functions
CREATE OR REPLACE FUNCTION is_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = p_chat_id AND cm.user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_chat_admin(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = p_chat_id AND cm.user_id = p_user_id AND cm.role = 'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION can_manage_chat(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN is_chat_admin(p_chat_id, p_user_id);
END;
$$;

-- Temporarily disable RLS
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Create new policies for chats
CREATE POLICY "Users can view chats they are members of"
ON chats FOR SELECT
TO authenticated
USING (
  is_chat_member(id, auth.uid())
);

CREATE POLICY "Users can create chats"
ON chats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update their own chats"
ON chats FOR UPDATE
TO authenticated
USING (
  can_manage_chat(id, auth.uid())
)
WITH CHECK (
  can_manage_chat(id, auth.uid())
);

-- Create new policies for chat_members
CREATE POLICY "Users can view their own memberships"
ON chat_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view members of their chats"
ON chat_members FOR SELECT
TO authenticated
USING (
  is_chat_member(chat_id, auth.uid())
);

CREATE POLICY "Users can add members to their chats"
ON chat_members FOR INSERT
TO authenticated
WITH CHECK (
  can_manage_chat(chat_id, auth.uid())
);

CREATE POLICY "Users can remove themselves from chats"
ON chat_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Create new policies for messages
CREATE POLICY "Users can view messages in their chats"
ON messages FOR SELECT
TO authenticated
USING (
  is_chat_member(chat_id, auth.uid())
);

CREATE POLICY "Users can send messages to their chats"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  is_chat_member(chat_id, auth.uid())
  AND sender_id = auth.uid()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Re-enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable realtime for the tables if they're not already members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chats;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$; 