package com.autoops.execution.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "executions")
public class Execution {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String type;
    private String title;
    @Column(name = "workflow_id")
    private Long workflowId;
    @Column(name = "command_definition_id")
    private Long commandDefinitionId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String parameters;
    @Column(name = "run_with_sudo", nullable = false)
    private boolean runWithSudo;
    @Column(name = "started_by", nullable = false)
    private Long startedBy;
    @Column(nullable = false)
    private String mode = "MANUAL";
    @Column(nullable = false)
    private Integer concurrency = 1;
    @Column(name = "failure_policy", nullable = false)
    private String failurePolicy = "STOP_NEW_MACHINES";
    @Column(name = "risk_level", nullable = false)
    private String riskLevel = "LOW";
    @Column(nullable = false)
    private String status = ExecutionStatus.PENDING;
    @Column(name = "failure_reason", columnDefinition = "text")
    private String failureReason;
    @Column(name = "cancel_requested_at")
    private Instant cancelRequestedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    public Long getId() { return id; }
    public String getType() { return type; }
    public void setType(String v) { type = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { title = v; }
    public Long getWorkflowId() { return workflowId; }
    public void setWorkflowId(Long v) { workflowId = v; }
    public Long getCommandDefinitionId() { return commandDefinitionId; }
    public void setCommandDefinitionId(Long v) { commandDefinitionId = v; }
    public String getParameters() { return parameters; }
    public void setParameters(String v) { parameters = v; }
    public boolean isRunWithSudo() { return runWithSudo; }
    public void setRunWithSudo(boolean v) { runWithSudo = v; }
    public Long getStartedBy() { return startedBy; }
    public void setStartedBy(Long v) { startedBy = v; }
    public String getMode() { return mode; }
    public void setMode(String v) { mode = v; }
    public Integer getConcurrency() { return concurrency; }
    public void setConcurrency(Integer v) { concurrency = v; }
    public String getFailurePolicy() { return failurePolicy; }
    public void setFailurePolicy(String v) { failurePolicy = v; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { riskLevel = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String v) { failureReason = v; }
    public Instant getCancelRequestedAt() { return cancelRequestedAt; }
    public void setCancelRequestedAt(Instant v) { cancelRequestedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { finishedAt = v; }
}
