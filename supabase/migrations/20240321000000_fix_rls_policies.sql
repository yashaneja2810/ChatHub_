-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view chat members of their chats" ON chat_members;
DROP POLICY IF EXISTS "Users can add themselves to chats" ON chat_members;
DROP POLICY IF EXISTS "Users can remove themselves from chats" ON chat_members;
DROP POLICY IF EXISTS "Chat admins can manage members" ON chat_members;

-- Create new policies with proper checks to avoid recursion
CREATE POLICY "Users can view their own chat memberships"
ON chat_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "Users can view chat members of their chats"
ON chat_members
FOR SELECT
TO authenticated
USING (
  chat_id IN (
    SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can add themselves to chats"
ON chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Allow if it's a direct chat
    EXISTS (
      SELECT 1 FROM chats c
      WHERE c.id = chat_id
      AND c.type = 'direct'
    )
    OR
    -- Allow if user is invited to a group chat
    EXISTS (
      SELECT 1 FROM group_invitations gi
      WHERE gi.chat_id = chat_members.chat_id
      AND gi.invitee_id = auth.uid()
      AND gi.status = 'accepted'
    )
  )
);

CREATE POLICY "Users can remove themselves from chats"
ON chat_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);

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

-- Enable RLS
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_chat ON chat_members(user_id, chat_id); 