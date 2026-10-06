package com.autoops.execution.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A persisted human decision gate. Scope EXECUTION gates the first real operation of an execution; STEP gates one
 * workflow step on one machine; RETRY records the explicit confirmation of a retry.
 */
@Entity
@Table(name = "approval_requests")
public class ApprovalRequest {
    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";
    public static final String EXPIRED = "EXPIRED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "execution_id")
    private Long executionId;
    @Column(name = "machine_run_id")
    private Long machineRunId;
    @Column(name = "step_run_id")
    private Long stepRunId;
    @Column(nullable = false)
    private String scope = "STEP";
    @Column(name = "risk_level", nullable = false)
    private String riskLevel = "LOW";
    @Column(columnDefinition = "text")
    private String reason;
    @Column(nullable = false)
    private String status = PENDING;
    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt = Instant.now();
    @Column(name = "approved_by")
    private Long approvedBy;
    @Column(name = "decided_at")
    private Instant decidedAt;
    @Column(name = "high_risk_acknowledged", nullable = false)
    private boolean highRiskAcknowledged;
    @Column(name = "decision_comment", columnDefinition = "text")
    private String decisionComment;

    public Long getId() { return id; }
    public Long getExecutionId() { return executionId; }
    public void setExecutionId(Long v) { executionId = v; }
    public Long getMachineRunId() { return machineRunId; }
    public void setMachineRunId(Long v) { machineRunId = v; }
    public Long getStepRunId() { return stepRunId; }
    public void setStepRunId(Long v) { stepRunId = v; }
    public String getScope() { return scope; }
    public void setScope(String v) { scope = v; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { riskLevel = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { reason = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public Instant getRequestedAt() { return requestedAt; }
    public Long getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Long v) { approvedBy = v; }
    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant v) { decidedAt = v; }
    public boolean isHighRiskAcknowledged() { return highRiskAcknowledged; }
    public void setHighRiskAcknowledged(boolean v) { highRiskAcknowledged = v; }
    public String getDecisionComment() { return decisionComment; }
    public void setDecisionComment(String v) { decisionComment = v; }
}
