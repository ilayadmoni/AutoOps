package com.autoops.execution.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "machine_runs")
public class MachineRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "execution_id", nullable = false)
    private Long executionId;
    @Column(name = "machine_id", nullable = false)
    private Long machineId;
    @Column(name = "credential_id")
    private Long credentialId;
    @Column(nullable = false)
    private Integer position = 0;
    @Column(nullable = false)
    private String status = ExecutionStatus.PENDING;
    @Column(name = "failure_reason", columnDefinition = "text")
    private String failureReason;
    @Column(name = "started_at")
    private Instant startedAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    public Long getId() { return id; }
    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long v) { executionId = v; }
    public Long getMachineId() { return machineId; }
    public void setMachineId(Long v) { machineId = v; }
    public Long getCredentialId() { return credentialId; }
    public void setCredentialId(Long v) { credentialId = v; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer v) { position = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String v) { failureReason = v; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant v) { startedAt = v; }
    public Instant getFinishedAt() { return finishedAt; }
    public void setFinishedAt(Instant v) { finishedAt = v; }
}
