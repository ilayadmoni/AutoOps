package com.autoops.execution.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "step_runs")
public class StepRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "machine_run_id", nullable = false)
    private Long machineRunId;
    @Column(name = "workflow_step_id")
    private Long workflowStepId;
    @Column(name = "step_key")
    private String stepKey;
    @Column(name = "step_type")
    private String stepType;
    @Column(name = "step_name")
    private String stepName;
    @Column(name = "risk_level")
    private String riskLevel;
    @Column(name = "run_with_sudo", nullable = false)
    private boolean runWithSudo;
    @Column(nullable = false)
    private String status = ExecutionStatus.PENDING;
    @Column(name = "original_command", columnDefinition = "text")
    private String originalCommand;
    @Column(name = "resolved_command", columnDefinition = "text")
    private String resolvedCommand;
    @Column(columnDefinition = "text")
    private String stdout;
    @Column(columnDefinition = "text")
    private String stderr;
    @Column(name = "exit_code")
    private Integer exitCode;
    @Column(name = "failure_reason", columnDefinition = "text")
    private String failureReason;
    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber = 1;
    @Column(name = "retry_of_step_run_id")
    private Long retryOfStepRunId;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    public Long getId() { return id; }
    public Long getMachineRunId() { return machineRunId; }
    public void setMachineRunId(Long v) { machineRunId = v; }
    public Long getWorkflowStepId() { return workflowStepId; }
    public void setWorkflowStepId(Long v) { workflowStepId = v; }
    public String getStepKey() { return stepKey; }
    public void setStepKey(String v) { stepKey = v; }
    public String getStepType() { return stepType; }
    public void setStepType(String v) { stepType = v; }
    public String getStepName() { return stepName; }
    public void setStepName(String v) { stepName = v; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { riskLevel = v; }
    public boolean isRunWithSudo() { return runWithSudo; }
    public void setRunWithSudo(boolean v) { runWithSudo = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getOriginalCommand() { return originalCommand; }
    public void setOriginalCommand(String v) { originalCommand = v; }
    public String getResolvedCommand() { return resolvedCommand; }
    public void setResolvedCommand(String v) { resolvedCommand = v; }
    public String getStdout() { return stdout; }
    public void setStdout(String v) { stdout = v; }
    public String getStderr() { return stderr; }
    public void setStderr(String v) { stderr = v; }
    public Integer getExitCode() { return exitCode; }
    public void setExitCode(Integer v) { exitCode = v; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String v) { failureReason = v; }
    public Integer getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(Integer v) { attemptNumber = v; }
    public Long getRetryOfStepRunId() { return retryOfStepRunId; }
    public void setRetryOfStepRunId(Long v) { retryOfStepRunId = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { finishedAt = v; }
}
