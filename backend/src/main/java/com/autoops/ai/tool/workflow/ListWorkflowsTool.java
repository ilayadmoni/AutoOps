package com.autoops.ai.tool.workflow;

import com.autoops.ai.tool.AITool;
import com.autoops.workflow.service.WorkflowService;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class ListWorkflowsTool implements AITool {
    private final WorkflowService workflows;

    public ListWorkflowsTool(WorkflowService workflows) {
        this.workflows = workflows;
    }

    public String name() { return "list_workflows"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() { return "List the user's saved workflows (id, name, step count)."; }

    public Map<String, Object> schema() { return Map.of("type", "object", "properties", Map.of()); }

    public Object execute(Map<String, Object> args, Long user) {
        return Map.of("workflows", workflows.list(user).stream()
                .map(w -> Map.of("id", w.id(), "name", w.name(), "stepCount", w.stepCount(), "description", w.description() == null ? "" : w.description()))
                .toList());
    }
}
