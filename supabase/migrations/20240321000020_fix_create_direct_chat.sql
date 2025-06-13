-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_direct_chat;

-- Create the updated function
CREATE OR REPLACE FUNCTION create_direct_chat(
  p_user1_id UUID,
  p_user2_id UUID
) RETURNS UUID AS $$
DECLARE
  v_chat_id UUID;
  v_existing_chat_id UUID;
BEGIN
  -- Check if a direct chat already exists between these users
  SELECT c.id INTO v_existing_chat_id
  FROM chats c
  JOIN chat_members cm1 ON c.id = cm1.chat_id
  JOIN chat_members cm2 ON c.id = cm2.chat_id
  WHERE c.type = 'direct'
    AND cm1.user_id = p_user1_id
    AND cm2.user_id = p_user2_id
  LIMIT 1;

  -- If a chat exists, return its ID
  IF v_existing_chat_id IS NOT NULL THEN
    RETURN v_existing_chat_id;
  END IF;

  -- Create new chat
  INSERT INTO chats (type)
  VALUES ('direct')
  RETURNING id INTO v_chat_id;

  -- Add both users as members
  INSERT INTO chat_members (chat_id, user_id, role)
  VALUES 
    (v_chat_id, p_user1_id, 'member'),
    (v_chat_id, p_user2_id, 'member');

  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_direct_chat TO authenticated; 