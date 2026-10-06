package com.autoops.ai.tool.command;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.ToolArgs;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.command.service.CommandService;
import com.autoops.machine.service.MachineService;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Proposes running an approved command. Validates command, parameters and machine ownership server-side and returns
 * a PROPOSE_COMMAND_RUN operation; the user must still open the Run dialog and confirm. Nothing executes here.
 */
@Component
public class ProposeCommandRunTool implements AITool {
    private final CommandService commands;
    private final MachineService machines;

    public ProposeCommandRunTool(CommandService commands, MachineService machines) {
        this.commands = commands;
        this.machines = machines;
    }

    public String name() { return "propose_command_run"; }

    public ToolRisk risk() { return ToolRisk.PROPOSE; }

    public String description() {
        return "Propose running one approved command on some of the user's machines. Returns a proposal the user reviews and confirms; it does not run.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "commandDefinitionId", Map.of("type", "integer"),
                "machineIds", Map.of("type", "array", "items", Map.of("type", "integer")),
                "parameters", Map.of("type", "object", "additionalProperties", Map.of("type", "string")),
                "runWithSudo", Map.of("type", "boolean"),
                "reason", Map.of("type", "string")), "required", List.of("commandDefinitionId"));
    }

    @SuppressWarnings("unchecked")
    public Object execute(Map<String, Object> args, Long user) {
        Long commandId = ToolArgs.requireLong(args, "commandDefinitionId");
        var cmd = commands.requireRunnable(commandId);
        Map<String, String> params = new LinkedHashMap<>();
        if (args.get("parameters") instanceof Map<?, ?> p) {
            p.forEach((k, v) -> params.put(String.valueOf(k), v == null ? null : String.valueOf(v)));
        }
        List<Long> machineIds = new ArrayList<>();
        if (args.get("machineIds") instanceof List<?> l) {
            for (Object o : l) {
                machineIds.add(ToolArgs.requireLong(Map.of("id", o), "id"));
            }
        }
        machineIds.forEach(id -> machines.requireOwned(user, id));
        boolean sudo = Boolean.TRUE.equals(args.get("runWithSudo"));
        List<Map<String, String>> missing = new ArrayList<>();
        String preview = null;
        String risk = cmd.getRiskLevel();
        try {
            var result = commands.preview(new AuthenticatedUser(user, "", "USER"), commandId, params, sudo);
            preview = result.resolvedCommand();
            risk = result.effectiveRiskLevel();
        } catch (ApiException e) {
            e.fieldErrors().forEach((k, v) -> missing.add(Map.of("field", "parameters." + k, "message", v)));
        }
        if (machineIds.isEmpty()) {
            missing.add(Map.of("field", "machineIds", "message", "Select at least one machine"));
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("commandDefinitionId", commandId);
        payload.put("commandName", cmd.getName());
        payload.put("parameters", params);
        payload.put("machineIds", machineIds);
        payload.put("runWithSudo", sudo);
        payload.put("riskLevel", risk);
        payload.put("preview", preview);
        payload.put("reason", Objects.toString(args.get("reason"), ""));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("operation", Map.of("type", "PROPOSE_COMMAND_RUN", "payload", payload));
        out.put("missingFields", missing);
        out.put("requiresUserConfirmation", true);
        return out;
    }
}
