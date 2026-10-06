package com.autoops.ai.tool.workflow;

import com.autoops.ai.tool.AITool;
import com.autoops.workflow.dto.WorkflowDtos;
import com.autoops.workflow.service.WorkflowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Runs the real server-side workflow validator on a draft. Nothing is saved. */
@Component
public class ValidateWorkflowTool implements AITool {
    private final WorkflowService workflows;
    private final ObjectMapper json;

    public ValidateWorkflowTool(WorkflowService workflows, ObjectMapper json) {
        this.workflows = workflows;
        this.json = json;
    }

    public String name() { return "validate_workflow_draft"; }

    public ToolRisk risk() { return ToolRisk.VALIDATE; }

    public String description() {
        return "Validate a workflow draft (name, description, nodes) with the AutoOps validator. Returns node/field errors. Does not save.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string"),
                "description", Map.of("type", "string"),
                "nodes", ProposeWorkflowDraftTool.NODES_SCHEMA), "required", List.of("name", "nodes"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        WorkflowDtos.Save draft;
        try {
            draft = json.convertValue(args, WorkflowDtos.Save.class);
        } catch (IllegalArgumentException e) {
            return new WorkflowDtos.ValidationResult(false, List.of(new WorkflowDtos.ValidationError(null, "nodes", "Draft does not match the workflow schema")));
        }
        return workflows.validate(user, draft);
    }
}
