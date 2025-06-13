/*
  # Group Invitations Schema

  1. New Tables
    - `group_invitations`
      - `id` (uuid, primary key)
      - `chat_id` (uuid, references chats)
      - `inviter_id` (uuid, references profiles)
      - `invitee_id` (uuid, references profiles)
      - `status` (text: pending, accepted, declined)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add appropriate policies for invitation management
*/

CREATE TABLE IF NOT EXISTS group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, invitee_id)
);

ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations involving them"
  ON group_invitations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Group members can send invitations"
  ON group_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = inviter_id AND
    chat_id IN (
      SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invitations they received"
  ON group_invitations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_id);