-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS user_chat_memberships;

-- Create a materialized view for user chat memberships
CREATE MATERIALIZED VIEW user_chat_memberships AS
SELECT DISTINCT
  cm.user_id,
  cm.chat_id,
  cm.role
FROM chat_members cm;

-- Create index on the materialized view
CREATE UNIQUE INDEX user_chat_memberships_idx ON user_chat_memberships (user_id, chat_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_chat_memberships()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_chat_memberships;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh the materialized view
DROP TRIGGER IF EXISTS refresh_chat_memberships_trigger ON chat_members;
CREATE TRIGGER refresh_chat_memberships_trigger
AFTER INSERT OR UPDATE OR DELETE ON chat_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_chat_memberships();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;

-- Create new policies using the materialized view
CREATE POLICY "Users can view their own chats"
ON chats FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_chat_memberships
    WHERE user_chat_memberships.chat_id = chats.id
    AND user_chat_memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own chat memberships"
ON chat_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "Users can view their own messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_chat_memberships
    WHERE user_chat_memberships.chat_id = messages.chat_id
    AND user_chat_memberships.user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 