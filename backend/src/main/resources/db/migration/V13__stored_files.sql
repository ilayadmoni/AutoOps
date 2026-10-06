-- Stored files: content type, soft delete and orphan tracking.
ALTER TABLE stored_files ADD COLUMN content_type VARCHAR(255);
ALTER TABLE stored_files ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_stored_files_owner ON stored_files(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_stored_files_orphaned ON stored_files(orphaned_at) WHERE orphaned_at IS NOT NULL;
