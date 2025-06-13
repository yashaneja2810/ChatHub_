-- Drop existing policies
DROP POLICY IF EXISTS "Users can view members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;

-- Create a materialized view to cache chat membership data
CREATE MATERIALIZED VIEW IF NOT EXISTS chat_membership_cache AS
SELECT DISTINCT cm1.chat_id, cm1.user_id
FROM chat_members cm1;

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_chat_membership_cache()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY chat_membership_cache;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to refresh the materialized view
DROP TRIGGER IF EXISTS refresh_chat_membership_cache_trigger ON chat_members;
CREATE TRIGGER refresh_chat_membership_cache_trigger
AFTER INSERT OR UPDATE OR DELETE ON chat_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_chat_membership_cache();

-- Create new policy using the materialized view
CREATE POLICY "Users can view members of their chats"
  ON chat_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_membership_cache cmc
      WHERE cmc.chat_id = chat_members.chat_id
      AND cmc.user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON chat_membership_cache TO authenticated; 