-- Conversations: persisted assistant operations and efficient per-user listing.
ALTER TABLE conversation_messages ADD COLUMN operations JSONB;
ALTER TABLE conversation_messages ADD COLUMN missing_fields JSONB;
CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
ALTER TABLE conversation_messages DROP CONSTRAINT conversation_messages_conversation_id_fkey;
ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
