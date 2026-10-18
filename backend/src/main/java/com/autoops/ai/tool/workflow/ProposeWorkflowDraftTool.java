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
            Map.entry("customCommand", Map.of("type", "string", "description", "COMMAND only: the full shell command TEXT this step "
                    + "runs, e.g. \"docker compose up -d\" (a string, never true/false). Use it instead of commandDefinitionId when the "
                    + "user gives the command or asks for a custom one, or no approved command fits. No sudo (use runWithSudo), no {{placeholders}}.")),
            Map.entry("parameters", Map.of("type", "object", "additionalProperties", Map.of("type", "string"))),
            Map.entry("runWithSudo", Map.of("type", "boolean")),
            Map.entry("requiresApproval", Map.of("type", "boolean")),
            Map.entry("timeoutSeconds", Map.of("type", "integer")),
            Map.entry("storedFileId", Map.of("type", "integer")),
            Map.entry("destinationPath", Map.of("type", "string")),
            Map.entry("overwrite", Map.of("type", "boolean", "description", "Default false; replace only when the user explicitly requests it")),
            Map.entry("useSudo", Map.of("type", "boolean", "description", "Default false; use only when explicitly requested")),
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
        return "Build and propose the workflow as soon as its action is known, even one file/folder copy. Infer a short name; description is optional. "
                + "Use attached resource ids without asking again. Command steps use approved ids or customCommand; file copies need no command search. "
                + "The user reviews the draft in the Builder; this tool never saves or runs it.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string", "description", "Generate a concise title from the user's goal; do not ask the user to supply it"),
                "description", Map.of("type", "string", "description", "Optional; do not delay a draft to request it"),
                "nodes", NODES_SCHEMA), "required", List.of("name", "nodes"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        Map<String, Object> fixed = withDefaults(args);
        List<String> unusable = flagCommands(fixed);
        if (!unusable.isEmpty()) {
            // Never let a flag like `true` become the command a server runs; the model must resend the text.
            return Map.of("accepted", false, "error", "customCommand must be the shell command text itself (for example "
                    + "\"docker compose up -d\"), not true/false. Call propose_workflow_draft again with the command text for step(s): "
                    + String.join(", ", unusable));
        }
        WorkflowDtos.Save draft;
        try {
            draft = json.convertValue(fixed, WorkflowDtos.Save.class);
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

    /** Keys models use for a step's command text when they treat `customCommand` as an on/off flag. */
    private static final List<String> COMMAND_TEXT_KEYS = List.of("command", "commandTemplate", "commandLine", "cmd", "shellCommand", "script");

    /**
     * Repairs `customCommand` values that are not command text: the text is taken from a sibling key when the model put
     * it there, a `false` flag is dropped, and the keys of steps that still have no usable text are returned.
     */
    @SuppressWarnings("unchecked")
    static List<String> flagCommands(Map<String, Object> draft) {
        List<String> unusable = new ArrayList<>();
        if (!(draft.get("nodes") instanceof List<?> nodes)) {
            return unusable;
        }
        for (Object o : nodes) {
            if (!(o instanceof Map<?, ?> m) || !m.containsKey("customCommand") || m.get("customCommand") instanceof String) {
                continue;
            }
            Map<String, Object> n = (Map<String, Object>) m;
            Object flag = n.remove("customCommand");
            String text = COMMAND_TEXT_KEYS.stream().map(n::get).filter(v -> v instanceof String s && !s.isBlank())
                    .map(v -> ((String) v).strip()).findFirst().orElse(null);
            if (text != null) {
                n.put("customCommand", text);
            } else if (Boolean.TRUE.equals(flag)) {
                unusable.add(Objects.toString(n.get("key"), "?"));
            }
        }
        return unusable;
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
