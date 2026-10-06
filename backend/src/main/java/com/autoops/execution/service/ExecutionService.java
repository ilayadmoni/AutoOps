package com.autoops.execution.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandService;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.engine.ExecutionEngine;
import com.autoops.execution.engine.ExecutionPlanFactory;
import com.autoops.execution.entity.Execution;
import com.autoops.execution.entity.ExecutionStatus;
import com.autoops.execution.entity.MachineRun;
import com.autoops.execution.plan.ExecutionPlan;
import com.autoops.execution.plan.PlanStep;
import com.autoops.execution.plan.StepDefinition;
import com.autoops.execution.plan.StepResolver;
import com.autoops.execution.repository.ExecutionRepository;
import com.autoops.execution.repository.MachineRunRepository;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

/** Validates and creates executions, then hands them to the engine. Shared by command and workflow runs. */
@Service
public class ExecutionService {
    private final ExecutionRepository executions;
    private final MachineRunRepository machineRuns;
    private final MachineService machines;
    private final CredentialManagementService credentials;
    private final CommandService commands;
    private final StepResolver resolver;
    private final ExecutionEngine engine;
    private final ExecutionQueryService queries;
    private final AuditService audit;
    private final ObjectMapper json;
    private final TransactionTemplate tx;
    private final int maxConcurrency;

    public ExecutionService(ExecutionRepository executions, MachineRunRepository machineRuns, MachineService machines,
                            CredentialManagementService credentials, CommandService commands, StepResolver resolver, ExecutionEngine engine,
                            ExecutionQueryService queries, AuditService audit, ObjectMapper json, TransactionTemplate tx,
                            @Value("${autoops.execution.max-concurrency:3}") int maxConcurrency) {
        this.executions = executions;
        this.machineRuns = machineRuns;
        this.machines = machines;
        this.credentials = credentials;
        this.commands = commands;
        this.resolver = resolver;
        this.engine = engine;
        this.queries = queries;
        this.audit = audit;
        this.json = json;
        this.tx = tx;
        this.maxConcurrency = Math.max(1, Math.min(3, maxConcurrency));
    }

    public ExecutionDtos.Detail startCommand(AuthenticatedUser user, ExecutionDtos.StartCommand r) {
        var cmd = commands.requireRunnable(r.commandDefinitionId());
        boolean sudo = Boolean.TRUE.equals(r.runWithSudo());
        Map<String, String> params = r.parameters() == null ? Map.of() : r.parameters();
        var step = new PlanStep(ExecutionPlanFactory.COMMAND_STEP_KEY, null, cmd.getName(), false,
                new StepDefinition.Command(cmd.getId(), params, sudo, ExecutionPlanFactory.COMMAND_TIMEOUT_SECONDS), null, null);
        // Fails fast with field-level errors; the engine resolves again right before running.
        var resolved = resolver.resolve(step, user.id());
        var options = new ExecutionDtos.RunOptions(r.machineIds(), r.credentialId(), r.mode(), r.concurrency(), r.failurePolicy());
        return create(user, "COMMAND", cmd.getName(), cmd.getId(), null, write(params), sudo, resolved.riskLevel(), options);
    }

    /** Computes the highest risk across a plan; used for workflow runs. */
    public String planRisk(ExecutionPlan plan, Long userId) {
        var risk = CommandRiskAnalyzer.Risk.LOW;
        for (PlanStep s : plan.steps()) {
            risk = CommandRiskAnalyzer.max(risk, CommandRiskAnalyzer.Risk.valueOf(resolver.resolve(s, userId).riskLevel()));
        }
        return risk.name();
    }

    public ExecutionDtos.Detail create(AuthenticatedUser user, String type, String title, Long commandId, Long workflowId,
                                       String paramsJson, boolean sudo, String risk, ExecutionDtos.RunOptions o) {
        int concurrency = o.concurrency() == null ? 1 : o.concurrency();
        if (concurrency < 1 || concurrency > maxConcurrency) {
            throw ApiException.validation("Concurrency must be between 1 and " + maxConcurrency, Map.of("concurrency", "1-" + maxConcurrency));
        }
        List<Long> machineIds = new ArrayList<>(new LinkedHashSet<>(o.machineIds()));
        Map<String, String> errors = new LinkedHashMap<>();
        List<long[]> targets = new ArrayList<>();
        if (o.credentialId() != null) {
            credentials.requireOwned(user.id(), o.credentialId());
        }
        for (Long machineId : machineIds) {
            Machine m = machines.requireOwned(user.id(), machineId);
            Long cred = o.credentialId() != null ? o.credentialId() : m.getPreferredCredentialId();
            if (cred == null) {
                errors.put("machine:" + m.getId(), "Machine '" + m.getName() + "' has no preferred credential; select a credential");
                continue;
            }
            credentials.requireOwned(user.id(), cred);
            targets.add(new long[]{m.getId(), cred});
        }
        if (!errors.isEmpty()) {
            throw ApiException.validation("Some machines cannot be used", errors);
        }
        Long id = tx.execute(s -> {
            Execution e = new Execution();
            e.setType(type);
            e.setTitle(title);
            e.setCommandDefinitionId(commandId);
            e.setWorkflowId(workflowId);
            e.setParameters(paramsJson);
            e.setRunWithSudo(sudo);
            e.setStartedBy(user.id());
            e.setMode(o.mode() == null ? "MANUAL" : o.mode());
            e.setConcurrency(concurrency);
            e.setFailurePolicy(o.failurePolicy() == null ? "STOP_NEW_MACHINES" : o.failurePolicy());
            e.setRiskLevel(risk);
            e.setStatus(ExecutionStatus.PENDING);
            e = executions.save(e);
            int pos = 0;
            for (long[] t : targets) {
                MachineRun mr = new MachineRun();
                mr.setExecutionId(e.getId());
                mr.setMachineId(t[0]);
                mr.setCredentialId(t[1]);
                mr.setPosition(pos++);
                machineRuns.save(mr);
            }
            return e.getId();
        });
        audit.record(user.id(), "EXECUTION_STARTED", "EXECUTION", id, Map.of("type", type, "title", title, "risk", risk,
                "mode", o.mode() == null ? "MANUAL" : o.mode(), "machines", targets.size()));
        engine.launch(id);
        return queries.detail(user, id);
    }

    private String write(Map<String, String> params) {
        try {
            return json.writeValueAsString(params);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
