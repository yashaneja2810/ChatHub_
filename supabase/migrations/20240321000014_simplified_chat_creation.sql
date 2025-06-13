-- Drop existing policies and functions
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
DROP POLICY IF EXISTS "Users can view their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can manage their own chat memberships" ON chat_members;
DROP POLICY IF EXISTS "Users can manage their own chats" ON chats;

DROP FUNCTION IF EXISTS create_direct_chat(uuid, uuid);
DROP FUNCTION IF EXISTS is_chat_member(uuid);
DROP FUNCTION IF EXISTS is_chat_admin(uuid);
DROP FUNCTION IF EXISTS can_manage_chat(uuid);

-- Drop materialized view and its dependencies
DROP MATERIALIZED VIEW IF EXISTS user_chat_memberships;
DROP TRIGGER IF EXISTS refresh_chat_memberships_trigger ON chat_members;
DROP FUNCTION IF EXISTS refresh_chat_memberships();

-- Create new secure functions
CREATE OR REPLACE FUNCTION create_direct_chat(p_user_id uuid, p_friend_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat_id uuid;
    v_existing_chat_id uuid;
BEGIN
    -- Check if a direct chat already exists between these users
    SELECT c.id INTO v_existing_chat_id
    FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id
    JOIN chat_members cm2 ON cm2.chat_id = c.id
    WHERE c.type = 'direct'
    AND cm1.user_id = p_user_id
    AND cm2.user_id = p_friend_id
    LIMIT 1;

    IF v_existing_chat_id IS NOT NULL THEN
        RETURN v_existing_chat_id;
    END IF;

    -- Create new chat
    INSERT INTO chats (type, created_at, updated_at)
    VALUES ('direct', NOW(), NOW())
    RETURNING id INTO v_chat_id;

    -- Add both users as members
    INSERT INTO chat_members (chat_id, user_id, role, created_at)
    VALUES 
        (v_chat_id, p_user_id, 'admin', NOW()),
        (v_chat_id, p_friend_id, 'member', NOW());

    RETURN v_chat_id;
END;
$$;

-- Create new policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chat policies
CREATE POLICY "Users can view their own chats"
ON chats FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chat_members
        WHERE chat_id = chats.id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create chats"
ON chats FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own chats"
ON chats FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM chat_members
        WHERE chat_id = chats.id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Chat member policies
CREATE POLICY "Users can view their own chat memberships"
ON chat_members FOR SELECT
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM chat_members cm
        WHERE cm.chat_id = chat_members.chat_id
        AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their own chat memberships"
ON chat_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM chat_members cm
        WHERE cm.chat_id = chat_members.chat_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

-- Message policies
CREATE POLICY "Users can view messages in their chats"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chat_members
        WHERE chat_id = messages.chat_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert messages in their chats"
ON messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM chat_members
        WHERE chat_id = messages.chat_id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
USING (
    sender_id = auth.uid()
);

CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
USING (
    sender_id = auth.uid()
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable real-time updates with checks for existing memberships
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