package com.autoops.ai.tool.workflow;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.ToolArgs;
import com.autoops.workflow.service.WorkflowService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class GetWorkflowTool implements AITool {
    private final WorkflowService workflows;

    public GetWorkflowTool(WorkflowService workflows) {
        this.workflows = workflows;
    }

    public String name() { return "get_workflow"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() { return "Get one of the user's workflows with its typed steps and success/failure edges."; }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of("workflowId", Map.of("type", "integer")), "required", List.of("workflowId"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        return workflows.get(user, ToolArgs.requireLong(args, "workflowId"));
    }
}
