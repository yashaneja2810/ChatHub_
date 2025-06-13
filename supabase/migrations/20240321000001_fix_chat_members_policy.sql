-- Drop all existing policies on chat_members
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can add themselves to chats" ON chat_members;
DROP POLICY IF EXISTS "Users can remove themselves from chats" ON chat_members;
DROP POLICY IF EXISTS "Chat admins can manage members" ON chat_members;

-- Create new, simplified policies
CREATE POLICY "Users can view their own chat memberships"
ON chat_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view members of their chats"
ON chat_members
FOR SELECT
TO authenticated
USING (
  chat_id IN (
    SELECT chat_id 
    FROM chat_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can add themselves to direct chats"
ON chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM chats
    WHERE id = chat_id
    AND type = 'direct'
  )
);

CREATE POLICY "Users can remove themselves from chats"
ON chat_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Chat admins can manage members"
ON chat_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members cm
    WHERE cm.chat_id = chat_members.chat_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'admin'
  )
);

-- Ensure RLS is enabled
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY; 