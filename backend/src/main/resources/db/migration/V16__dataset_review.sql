-- Dataset imports: stored original metadata, analysis/preview, review decision and detailed counters.
ALTER TABLE dataset_imports ADD COLUMN size_bytes BIGINT;
ALTER TABLE dataset_imports ADD COLUMN checksum VARCHAR(128);
ALTER TABLE dataset_imports ADD COLUMN candidate_records INT DEFAULT 0;
ALTER TABLE dataset_imports ADD COLUMN invalid_records INT DEFAULT 0;
ALTER TABLE dataset_imports ADD COLUMN non_rhel_records INT DEFAULT 0;
ALTER TABLE dataset_imports ADD COLUMN analysis JSONB;
ALTER TABLE dataset_imports ADD COLUMN error_message TEXT;
ALTER TABLE dataset_imports ADD COLUMN reviewed_by BIGINT REFERENCES users(id);
ALTER TABLE dataset_imports ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE dataset_imports ADD COLUMN approve_up_to VARCHAR(20);
