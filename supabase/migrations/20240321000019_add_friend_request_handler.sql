-- Create function to handle friend request acceptance/rejection
CREATE OR REPLACE FUNCTION handle_friend_request(
  p_request_id UUID,
  p_accept BOOLEAN
) RETURNS void AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_chat_id UUID;
BEGIN
  -- Get the friend request details
  SELECT sender_id, receiver_id
  INTO v_sender_id, v_receiver_id
  FROM friend_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  -- Update the friend request status
  UPDATE friend_requests
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
  WHERE id = p_request_id;

  -- If accepted, create the friendship and chat
  IF p_accept THEN
    -- Check if friendship already exists
    IF NOT EXISTS (
      SELECT 1 FROM friendships
      WHERE (user1_id = v_sender_id AND user2_id = v_receiver_id)
         OR (user1_id = v_receiver_id AND user2_id = v_sender_id)
    ) THEN
      -- Create the friendship
      INSERT INTO friendships (user1_id, user2_id)
      VALUES (v_sender_id, v_receiver_id);

      -- Create a direct chat
      INSERT INTO chats (type, name)
      VALUES ('direct', NULL)
      RETURNING id INTO v_chat_id;

      -- Add both users to the chat
      INSERT INTO chat_members (chat_id, user_id)
      VALUES (v_chat_id, v_sender_id),
             (v_chat_id, v_receiver_id);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_friend_request TO authenticated;

-- Add unique index to chat_membership_cache
CREATE UNIQUE INDEX IF NOT EXISTS chat_membership_cache_unique_idx 
ON chat_membership_cache (chat_id, user_id); 