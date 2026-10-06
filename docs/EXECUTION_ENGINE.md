# Execution engine

`ExecutionService` validates a request and persists an `Execution` with one `MachineRun` per machine; the
`ExecutionEngine` then runs it asynchronously. Command runs and workflow runs share this path.

## Plan

`ExecutionPlanFactory` rebuilds the plan from persisted data: a single command step, or the workflow's typed steps
with success/failure edges. `StepResolver` resolves each step server-side — the command must still be APPROVED,
parameters are validated against the command's schema and quoted, files must belong to the owner — at creation
(fail fast), in preflight, and again immediately before the step runs.

## Phases

1. **Preflight (hard gate)** for every machine, at most `concurrency` in parallel: machine/credential eligibility,
   parameters, files, trusted host key, SSH + authentication (pinned key), RHEL family (`EXECUTION_REQUIRE_RHEL`),
   sudo when any step needs it. A failed preflight marks the machine FAILED; no real step runs there.
   With `STOP_NEW_MACHINES`, any preflight failure stops the whole execution before real work starts.
2. **Approval gate** before the first real operation: MANUAL mode always pauses (explicit Run); AUTOMATIC mode
   pauses only for HIGH risk. HIGH risk approval requires `highRiskAcknowledged`. Workflow steps flagged
   `requiresApproval` pause on each machine. Approvals are persisted `ApprovalRequest` rows; rejection cancels.
3. **Run** each machine's plan, at most `concurrency` (1–3) machines in flight. With `STOP_NEW_MACHINES` no new
   machine starts after a failure (remaining ones are SKIPPED); with `CONTINUE` the rest still run.
4. **Aggregate**: all machines SUCCESS → SUCCESS; some success → PARTIAL; nothing ran because of rejection/stop →
   CANCELLED; otherwise FAILED. A stop request always ends CANCELLED.

## Steps

- **Command**: approved template + validated parameters; optional sudo applied by the engine
  (`sudo -S` with the password on stdin; the wrapped command's stdin is `/dev/null`). Timeout 1–3600 s.
- **File transfer**: SFTP to a temporary path, SHA-256 verified on the machine, then moved into place with a fixed
  command (`mv`, or `cp` under sudo for privileged destinations). Overwrite is refused unless enabled.
- **Wait until**: bounded polling (interval 1–300 s, timeout 1–3600 s) of SERVICE_ACTIVE, FILE_EXISTS or a LOW-risk
  approved command (OUTPUT_CONTAINS / EXIT_CODE).

stdout/stderr are bounded (`EXECUTION_MAX_OUTPUT_BYTES`, head + tail kept) and persisted with exit code and timestamps.

## Stop and retry

- **Stop** persists `cancel_requested_at`, stops scheduling machines and steps, interrupts wait loops and pending
  approvals, and lets an already-running remote command finish (bounded by its timeout) before ending CANCELLED.
- **Retry** (owner, finished FAILED/PARTIAL execution, latest failed attempt) creates a new `StepRun` with
  `retryOfStepRunId`, records a RETRY approval row, executes the same re-resolved step and continues the plan.

## Restart behaviour

In-flight executions cannot survive a restart. On startup `ExecutionRecovery` marks them FAILED (or CANCELLED if a
stop was requested) with "Interrupted by server restart" and expires pending approvals.
