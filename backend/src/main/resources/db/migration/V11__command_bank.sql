-- Command Bank: review metadata and normalized template for de-duplication.
ALTER TABLE command_definitions ADD COLUMN rejection_reason TEXT;
ALTER TABLE command_definitions ADD COLUMN normalized_template TEXT;
UPDATE command_definitions SET normalized_template = lower(regexp_replace(trim(command_template), '\s+', ' ', 'g'));
CREATE INDEX idx_commands_normalized_template ON command_definitions(normalized_template);
CREATE INDEX idx_commands_created_by ON command_definitions(created_by);
