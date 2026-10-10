-- Imported commands remember the dataset import that added them, so deleting an import can remove its commands.
-- Commands a workflow or past execution still uses are kept; deleting the import then just unlinks them.
ALTER TABLE command_definitions ADD COLUMN dataset_import_id BIGINT REFERENCES dataset_imports(id) ON DELETE SET NULL;
CREATE INDEX idx_command_definitions_dataset_import ON command_definitions(dataset_import_id);
