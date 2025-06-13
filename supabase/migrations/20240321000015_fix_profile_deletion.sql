-- Drop existing views and triggers
DROP MATERIALIZED VIEW IF EXISTS user_chat_memberships;
DROP TRIGGER IF EXISTS refresh_chat_views_trigger ON chat_members;

-- Temporarily disable RLS
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE friendships DISABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests DISABLE ROW LEVEL SECURITY;

-- Update foreign key constraints with CASCADE
ALTER TABLE chat_members
  DROP CONSTRAINT IF EXISTS chat_members_user_id_fkey,
  ADD CONSTRAINT chat_members_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE friendships
  DROP CONSTRAINT IF EXISTS friendships_user1_id_fkey,
  DROP CONSTRAINT IF EXISTS friendships_user2_id_fkey,
  ADD CONSTRAINT friendships_user1_id_fkey
    FOREIGN KEY (user1_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT friendships_user2_id_fkey
    FOREIGN KEY (user2_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE friend_requests
  DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey,
  ADD CONSTRAINT friend_requests_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,
  ADD CONSTRAINT friend_requests_receiver_id_fkey
    FOREIGN KEY (receiver_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

-- Re-enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;

-- Create simplified policies without recursion
CREATE POLICY "Users can view their own chats"
ON chats FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
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
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = messages.chat_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own friendships"
ON friendships FOR SELECT
TO authenticated
USING (
  user1_id = auth.uid() OR user2_id = auth.uid()
);

CREATE POLICY "Users can view their own friend requests"
ON friend_requests FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 