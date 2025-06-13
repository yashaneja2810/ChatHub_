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

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS on_chat_created ON chats;
DROP FUNCTION IF EXISTS handle_new_chat();
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

-- Create function to handle new chat creation
CREATE OR REPLACE FUNCTION handle_new_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the creator as an admin member
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'admin');
  RETURN NEW;
END;
$$;

-- Create trigger for new chat creation
CREATE TRIGGER on_chat_created
  AFTER INSERT ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_chat();

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
  OR (
    -- Allow adding members to a new chat if the user is the creator
    EXISTS (
      SELECT 1 FROM chats c
      WHERE c.id = chat_id
      AND c.created_by = auth.uid()
      AND c.created_at > NOW() - INTERVAL '1 minute'
    )
  )
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

-- Enable realtime for the tables
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE chats, chat_members, messages; 