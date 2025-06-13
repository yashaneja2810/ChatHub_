-- Drop all existing policies
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

-- Drop existing materialized views if they exist
DROP MATERIALIZED VIEW IF EXISTS user_chat_memberships;
DROP MATERIALIZED VIEW IF EXISTS chat_member_details;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS refresh_chat_views_trigger ON chat_members;

-- Temporarily disable RLS
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Create a single materialized view that combines all the data we need
CREATE MATERIALIZED VIEW user_chat_memberships AS
SELECT 
  cm.user_id,
  cm.chat_id,
  cm.role as member_role,
  c.type as chat_type,
  c.name as chat_name,
  c.avatar_url as chat_avatar_url,
  c.created_at as chat_created_at,
  json_agg(
    json_build_object(
      'user_id', p.id,
      'role', cm2.role,
      'full_name', p.full_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'is_online', p.is_online,
      'last_seen', p.last_seen
    )
  ) as members
FROM chat_members cm
JOIN chats c ON c.id = cm.chat_id
JOIN chat_members cm2 ON cm2.chat_id = c.id
JOIN profiles p ON p.id = cm2.user_id
GROUP BY cm.user_id, cm.chat_id, cm.role, c.type, c.name, c.avatar_url, c.created_at;

-- Create indexes on materialized view
CREATE INDEX idx_user_chat_memberships_user_id ON user_chat_memberships(user_id);
CREATE INDEX idx_user_chat_memberships_chat_id ON user_chat_memberships(chat_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_chat_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_chat_memberships;
  RETURN NULL;
END;
$$;

-- Create triggers to refresh materialized view
CREATE TRIGGER refresh_chat_views_trigger
AFTER INSERT OR UPDATE OR DELETE ON chat_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_chat_views();

-- Re-enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create new policies for chats
CREATE POLICY "Users can view chats they are members of"
ON chats FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create chats"
ON chats FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update their own chats"
ON chats FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid() AND member_role = 'admin'
  )
)
WITH CHECK (
  id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid() AND member_role = 'admin'
  )
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
  chat_id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can add members to their chats"
ON chat_members FOR INSERT
TO authenticated
WITH CHECK (
  chat_id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid() AND member_role = 'admin'
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
  chat_id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their chats"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  chat_id IN (
    SELECT chat_id FROM user_chat_memberships WHERE user_id = auth.uid()
  )
  AND sender_id = auth.uid()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON user_chat_memberships TO authenticated;
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

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW user_chat_memberships; 