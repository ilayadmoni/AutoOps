-- Workflows: stable node keys, retirement of steps referenced by history, typed wait checks and privileged transfers.
ALTER TABLE workflow_steps ADD COLUMN step_key VARCHAR(64);
UPDATE workflow_steps SET step_key = 's' || id WHERE step_key IS NULL;
ALTER TABLE workflow_steps ALTER COLUMN step_key SET NOT NULL;
ALTER TABLE workflow_steps ADD COLUMN retired_at TIMESTAMPTZ;
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id) WHERE retired_at IS NULL;
CREATE INDEX idx_workflows_owner ON workflows(created_by) WHERE deleted_at IS NULL;

ALTER TABLE command_steps ALTER COLUMN command_template DROP NOT NULL;

ALTER TABLE file_transfer_steps ADD COLUMN use_sudo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE wait_until_steps ADD COLUMN command_definition_id BIGINT REFERENCES command_definitions(id);
ALTER TABLE wait_until_steps ADD COLUMN parameters JSONB;
ALTER TABLE wait_until_steps ADD COLUMN expected_exit_code INT;
ALTER TABLE wait_until_steps ADD COLUMN target TEXT;
ALTER TABLE wait_until_steps ADD COLUMN run_with_sudo BOOLEAN NOT NULL DEFAULT false;
