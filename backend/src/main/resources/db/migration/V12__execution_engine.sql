-- Execution engine: persisted plan inputs, risk, cancellation and complete approval metadata.
ALTER TABLE executions ADD COLUMN title VARCHAR(255);
ALTER TABLE executions ADD COLUMN parameters JSONB;
ALTER TABLE executions ADD COLUMN run_with_sudo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE executions ADD COLUMN risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW';
ALTER TABLE executions ADD COLUMN failure_reason TEXT;
ALTER TABLE executions ADD COLUMN cancel_requested_at TIMESTAMPTZ;
ALTER TABLE executions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_executions_status ON executions(status);

ALTER TABLE machine_runs ADD COLUMN position INT NOT NULL DEFAULT 0;

ALTER TABLE step_runs ADD COLUMN step_key VARCHAR(64);
ALTER TABLE step_runs ADD COLUMN step_type VARCHAR(30);
ALTER TABLE step_runs ADD COLUMN step_name VARCHAR(200);
ALTER TABLE step_runs ADD COLUMN risk_level VARCHAR(20);
ALTER TABLE step_runs ADD COLUMN run_with_sudo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE step_runs ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_step_runs_retry_of ON step_runs(retry_of_step_run_id);

ALTER TABLE approval_requests ALTER COLUMN step_run_id DROP NOT NULL;
ALTER TABLE approval_requests ADD COLUMN execution_id BIGINT REFERENCES executions(id);
ALTER TABLE approval_requests ADD COLUMN machine_run_id BIGINT REFERENCES machine_runs(id);
ALTER TABLE approval_requests ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'STEP';
ALTER TABLE approval_requests ADD COLUMN risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW';
ALTER TABLE approval_requests ADD COLUMN reason TEXT;
ALTER TABLE approval_requests ADD COLUMN high_risk_acknowledged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE approval_requests ADD COLUMN decision_comment TEXT;
CREATE INDEX idx_approvals_execution ON approval_requests(execution_id);
CREATE INDEX idx_approvals_status ON approval_requests(status);
