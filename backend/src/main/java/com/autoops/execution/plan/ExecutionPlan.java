package com.autoops.execution.plan;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Steps run on each machine starting at entry and following success/failure edges. Plans are acyclic. */
public final class ExecutionPlan {
    private final Map<String, PlanStep> steps = new LinkedHashMap<>();
    private final String entryKey;

    public ExecutionPlan(List<PlanStep> steps, String entryKey) {
        steps.forEach(s -> this.steps.put(s.key(), s));
        this.entryKey = entryKey;
    }

    public PlanStep entry() {
        return steps.get(entryKey);
    }

    public PlanStep step(String key) {
        return key == null ? null : steps.get(key);
    }

    public PlanStep next(PlanStep current, boolean success) {
        return step(success ? current.successNext() : current.failureNext());
    }

    public List<PlanStep> steps() {
        return List.copyOf(steps.values());
    }

    public int size() {
        return steps.size();
    }
}
