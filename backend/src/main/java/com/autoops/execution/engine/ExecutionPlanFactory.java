package com.autoops.execution.engine;

import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.workflow.service.WorkflowPlanBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Rebuilds the authoritative plan of an execution from persisted data (never from client input). */
@Component
public class ExecutionPlanFactory {
    public static final String COMMAND_STEP_KEY = "command";
    public static final int COMMAND_TIMEOUT_SECONDS = 300;

    private final CommandDefinitionRepository commands;
    private final WorkflowPlanBuilder workflows;
    private final ObjectMapper json;

    public ExecutionPlanFactory(CommandDefinitionRepository commands, WorkflowPlanBuilder workflows, ObjectMapper json) {
        this.commands = commands;
        this.workflows = workflows;
        this.json = json;
    }

    public ExecutionPlan build(Execution e) {
        if ("WORKFLOW".equals(e.getType())) {
            return workflows.plan(e.getWorkflowId());
        }
        String name = commands.findById(e.getCommandDefinitionId()).map(c -> c.getName()).orElse("Command");
        var step = new PlanStep(COMMAND_STEP_KEY, null, name, false,
                new StepDefinition.Command(e.getCommandDefinitionId(), parameters(e.getParameters()), e.isRunWithSudo(), COMMAND_TIMEOUT_SECONDS),
                null, null);
        return new ExecutionPlan(List.of(step), COMMAND_STEP_KEY);
    }

    public Map<String, String> parameters(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return json.readValue(raw, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
