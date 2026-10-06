package com.autoops.execution.plan;

/** A node of an execution plan. successNext/failureNext are keys of other steps or null (end of path). */
public record PlanStep(String key, Long workflowStepId, String name, boolean requiresApproval, StepDefinition definition,
                       String successNext, String failureNext) {
}
