-- Additive: existing files remain single-file objects; each folder upload is a new immutable package ID.
ALTER TABLE stored_files ADD COLUMN folder_name VARCHAR(150);
ALTER TABLE stored_files ADD COLUMN folder_manifest TEXT;
ALTER TABLE stored_files ADD COLUMN folder_file_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stored_files ADD CONSTRAINT stored_files_folder_metadata CHECK (
    (folder_name IS NULL AND folder_manifest IS NULL AND folder_file_count = 0)
    OR (folder_name IS NOT NULL AND folder_manifest IS NOT NULL AND folder_file_count > 0)
);
