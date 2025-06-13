-- Drop existing chat_members table if it exists
DROP TABLE IF EXISTS chat_members CASCADE;

-- Recreate chat_members table with correct structure
CREATE TABLE chat_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX idx_chat_members_chat_id ON chat_members(chat_id);

-- Enable Row Level Security
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own chat memberships"
  ON chat_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat memberships"
  ON chat_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat memberships"
  ON chat_members FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON chat_members TO authenticated; 