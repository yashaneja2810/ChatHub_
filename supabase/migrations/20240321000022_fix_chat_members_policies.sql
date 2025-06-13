-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can insert their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can delete their own chat memberships" ON chat_members;

-- Create new policies
CREATE POLICY "Users can view members of their chats"
  ON chat_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = chat_members.chat_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own chat memberships"
  ON chat_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat memberships"
  ON chat_members FOR DELETE
  USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 