package com.autoops.ai.validation;

import com.autoops.ai.dto.AIOperation;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.service.CommandService;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.command.service.ParameterSpec;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.service.MachineService;
import com.autoops.workflow.dto.WorkflowDtos;
import com.autoops.workflow.service.WorkflowService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Java-side validation of every AI operation before the frontend treats it as actionable. Unknown operation types are
 * dropped; known types are re-validated against current server state and annotated with missing fields.
 */
@Service
public class AIOperationValidator {
    public static final Set<String> SUPPORTED = Set.of("REPLACE_WORKFLOW_DRAFT", "PROPOSE_COMMAND_RUN", "PROPOSE_NEW_COMMAND", "PROPOSE_MACHINE", "ASK_USER");
    private static final Pattern HOST = Pattern.compile(MachineDtos.HOST_PATTERN);
    private final WorkflowService workflows;
    private final CommandService commands;
    private final MachineService machines;
    private final ObjectMapper json;
    private final CommandTemplateService templates;
    private final CommandDefinitionRepository commandRepo;

    public AIOperationValidator(WorkflowService workflows, CommandService commands, MachineService machines, ObjectMapper json,
                                CommandTemplateService templates, CommandDefinitionRepository commandRepo) {
        this.workflows = workflows;
        this.commands = commands;
        this.machines = machines;
        this.json = json;
        this.templates = templates;
        this.commandRepo = commandRepo;
    }

    /** Returns the validated operation, or empty when it must not be offered to the user at all. */
    @SuppressWarnings("unchecked")
    public Optional<AIOperation> validate(Map<String, Object> raw, Long userId) {
        if (raw == null || !(raw.get("type") instanceof String type) || !SUPPORTED.contains(type) || !(raw.get("payload") instanceof Map<?, ?> p)) {
            return Optional.empty();
        }
        Map<String, Object> payload = new LinkedHashMap<>((Map<String, Object>) p);
        List<AIOperation.MissingField> missing = new ArrayList<>();
        switch (type) {
            case "REPLACE_WORKFLOW_DRAFT" -> {
                WorkflowDtos.Save draft;
                try {
                    draft = json.convertValue(payload, WorkflowDtos.Save.class);
                } catch (IllegalArgumentException e) {
                    return Optional.empty();
                }
                workflows.validate(userId, draft).errors()
                        .forEach(e -> missing.add(new AIOperation.MissingField(e.nodeKey(), e.field(), e.message())));
            }
            case "PROPOSE_COMMAND_RUN" -> {
                Long commandId = payload.get("commandDefinitionId") instanceof Number n ? n.longValue() : null;
                if (commandId == null) {
                    return Optional.empty();
                }
                try {
                    commands.requireRunnable(commandId);
                    Map<String, String> params = payload.get("parameters") instanceof Map<?, ?> m ? (Map<String, String>) m : Map.of();
                    commands.preview(new AuthenticatedUser(userId, "", "USER"), commandId, params, Boolean.TRUE.equals(payload.get("runWithSudo")));
                } catch (ApiException e) {
                    if (e.fieldErrors().isEmpty()) {
                        return Optional.empty();
                    }
                    e.fieldErrors().forEach((k, v) -> missing.add(new AIOperation.MissingField(null, "parameters." + k, v)));
                }
                List<Long> ids = new ArrayList<>();
                if (payload.get("machineIds") instanceof List<?> l) {
                    for (Object o : l) {
                        if (o instanceof Number n) {
                            try {
                                machines.requireOwned(userId, n.longValue());
                                ids.add(n.longValue());
                            } catch (ApiException ignored) {
                                // Machines the user does not own are silently removed from the proposal.
                            }
                        }
                    }
                }
                payload.put("machineIds", ids);
                if (ids.isEmpty()) {
                    missing.add(new AIOperation.MissingField(null, "machineIds", "Select at least one machine"));
                }
            }
            case "PROPOSE_NEW_COMMAND" -> {
                String template = Objects.toString(payload.get("commandTemplate"), "");
                try {
                    List<ParameterSpec> specs = json.convertValue(payload.getOrDefault("parameters", List.of()), new TypeReference<List<ParameterSpec>>() {});
                    templates.validateTemplate(template, specs);
                } catch (RuntimeException e) {
                    return Optional.empty();
                }
                if (Objects.toString(payload.get("name"), "").isBlank() || commandRepo.existsByNormalizedTemplate(CommandDefinition.normalize(template))) {
                    return Optional.empty();
                }
            }
            case "PROPOSE_MACHINE" -> {
                if (!HOST.matcher(Objects.toString(payload.get("hostname"), "")).matches()) {
                    return Optional.empty();
                }
            }
            case "ASK_USER" -> {
                Optional<Map<String, Object>> question = QuestionPayload.normalize(payload);
                if (question.isEmpty()) {
                    return Optional.empty();
                }
                payload = new LinkedHashMap<>(question.get());
            }
            default -> {
                return Optional.empty();
            }
        }
        return Optional.of(new AIOperation(type, payload, missing));
    }
}
