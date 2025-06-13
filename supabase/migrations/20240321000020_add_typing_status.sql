-- Create typing_status table
CREATE TABLE IF NOT EXISTS typing_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

-- Add RLS policies
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing status of their chats"
    ON typing_status FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_members
            WHERE chat_members.chat_id = typing_status.chat_id
            AND chat_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own typing status"
    ON typing_status FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own typing status"
    ON typing_status FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Create function to update typing status
CREATE OR REPLACE FUNCTION update_typing_status(
    p_chat_id UUID,
    p_is_typing BOOLEAN
) RETURNS void AS $$
BEGIN
    INSERT INTO typing_status (chat_id, user_id, is_typing)
    VALUES (p_chat_id, auth.uid(), p_is_typing)
    ON CONFLICT (chat_id, user_id)
    DO UPDATE SET 
        is_typing = p_is_typing,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_typing_status TO authenticated; 