CREATE TABLE machine_folders (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    path VARCHAR(1000) NOT NULL UNIQUE,
    parent_id BIGINT REFERENCES machine_folders(id)
);
ALTER TABLE machines ADD COLUMN folder_id BIGINT REFERENCES machine_folders(id);
CREATE INDEX idx_machines_folder ON machines(folder_id) WHERE deleted_at IS NULL;
