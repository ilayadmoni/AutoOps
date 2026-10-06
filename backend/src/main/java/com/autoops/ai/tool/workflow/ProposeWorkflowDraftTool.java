package com.autoops.ai.tool.workflow;

import com.autoops.ai.tool.AITool;
import com.autoops.workflow.dto.WorkflowDtos;
import com.autoops.workflow.service.WorkflowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Proposes a workflow draft for the user to review. The draft is validated server-side and returned as a proposed
 * operation; it is never saved or run by this tool.
 */
@Component
public class ProposeWorkflowDraftTool implements AITool {
    static final Map<String, Object> NODES_SCHEMA = Map.of("type", "array", "items", Map.of("type", "object", "properties", Map.ofEntries(
            Map.entry("key", Map.of("type", "string", "description", "Unique step key, e.g. s1")),
            Map.entry("type", Map.of("type", "string", "enum", List.of("COMMAND", "FILE_TRANSFER", "WAIT_UNTIL"))),
            Map.entry("name", Map.of("type", "string")),
            Map.entry("successNext", Map.of("type", "string", "description", "Key of the next step on success; omit to end")),
            Map.entry("failureNext", Map.of("type", "string", "description", "Key of the step to run on failure; omit to stop")),
            Map.entry("commandDefinitionId", Map.of("type", "integer", "description", "Approved Command Bank id (from search_commands)")),
            Map.entry("parameters", Map.of("type", "object", "additionalProperties", Map.of("type", "string"))),
            Map.entry("runWithSudo", Map.of("type", "boolean")),
            Map.entry("requiresApproval", Map.of("type", "boolean")),
            Map.entry("timeoutSeconds", Map.of("type", "integer")),
            Map.entry("storedFileId", Map.of("type", "integer")),
            Map.entry("destinationPath", Map.of("type", "string")),
            Map.entry("checkType", Map.of("type", "string", "enum", List.of("OUTPUT_CONTAINS", "EXIT_CODE", "FILE_EXISTS", "SERVICE_ACTIVE"))),
            Map.entry("expectedOutput", Map.of("type", "string")),
            Map.entry("target", Map.of("type", "string")),
            Map.entry("intervalSeconds", Map.of("type", "integer"))), "required", List.of("key", "type", "name")));

    private final WorkflowService workflows;
    private final ObjectMapper json;

    public ProposeWorkflowDraftTool(WorkflowService workflows, ObjectMapper json) {
        this.workflows = workflows;
        this.json = json;
    }

    public String name() { return "propose_workflow_draft"; }

    public ToolRisk risk() { return ToolRisk.PROPOSE; }

    public String description() {
        return "Propose a complete workflow draft for the user to review in the Workflow Builder. Use only approved command ids from "
                + "search_commands. The draft is validated and shown to the user; it is never saved or executed automatically.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string"),
                "description", Map.of("type", "string"),
                "nodes", NODES_SCHEMA), "required", List.of("name", "nodes"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        WorkflowDtos.Save draft;
        try {
            draft = json.convertValue(withDefaults(args), WorkflowDtos.Save.class);
        } catch (IllegalArgumentException e) {
            return Map.of("accepted", false, "error", "Draft does not match the workflow schema");
        }
        var validation = workflows.validate(user, draft);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", draft.name());
        payload.put("description", draft.description() == null ? "" : draft.description());
        payload.put("nodes", draft.nodes());
        Map<String, Object> operation = Map.of("type", "REPLACE_WORKFLOW_DRAFT", "payload", payload);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("operation", operation);
        out.put("validation", validation);
        out.put("requiresUserConfirmation", true);
        return out;
    }

    /** Fills sensible defaults the model often omits (timeouts, intervals) so validation reports only real gaps. */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> withDefaults(Map<String, Object> args) {
        Map<String, Object> copy = new LinkedHashMap<>(args);
        Object nodes = copy.get("nodes");
        if (nodes instanceof List<?> list) {
            List<Object> out = new ArrayList<>();
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    Map<String, Object> n = new LinkedHashMap<>((Map<String, Object>) m);
                    String type = Objects.toString(n.get("type"), "");
                    n.putIfAbsent("timeoutSeconds", "WAIT_UNTIL".equals(type) ? 120 : 300);
                    if ("WAIT_UNTIL".equals(type)) {
                        n.putIfAbsent("intervalSeconds", 5);
                    }
                    out.add(n);
                } else {
                    out.add(o);
                }
            }
            copy.put("nodes", out);
        }
        return copy;
    }
}
