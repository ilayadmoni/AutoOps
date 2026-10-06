package com.autoops.workflow.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "workflow_steps")
@Inheritance(strategy = InheritanceType.JOINED)
public abstract class WorkflowStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Long id;
    @Column(name = "workflow_id", nullable = false)
    protected Long workflowId;
    @Column(name = "step_key", nullable = false)
    protected String stepKey;
    @Column(nullable = false)
    protected String name;
    protected String description;
    @Column(nullable = false)
    protected Integer position;
    @Column(name = "requires_approval", nullable = false)
    protected boolean requiresApproval;
    @Column(name = "success_next_step_id")
    protected Long successNextStepId;
    @Column(name = "failure_next_step_id")
    protected Long failureNextStepId;
    @Column(name = "retired_at")
    protected Instant retiredAt;

    /** COMMAND, FILE_TRANSFER or WAIT_UNTIL. */
    public abstract String type();

    public Long getId() { return id; }
    public Long getWorkflowId() { return workflowId; }
    public void setWorkflowId(Long v) { workflowId = v; }
    public String getStepKey() { return stepKey; }
    public void setStepKey(String v) { stepKey = v; }
    public String getName() { return name; }
    public void setName(String v) { name = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { description = v; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer v) { position = v; }
    public boolean isRequiresApproval() { return requiresApproval; }
    public void setRequiresApproval(boolean v) { requiresApproval = v; }
    public Long getSuccessNextStepId() { return successNextStepId; }
    public void setSuccessNextStepId(Long v) { successNextStepId = v; }
    public Long getFailureNextStepId() { return failureNextStepId; }
    public void setFailureNextStepId(Long v) { failureNextStepId = v; }
    public Instant getRetiredAt() { return retiredAt; }
    public void setRetiredAt(Instant v) { retiredAt = v; }
}
