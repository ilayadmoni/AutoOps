package com.autoops.workflow.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.common.error.ApiException;
import com.autoops.workflow.dto.WorkflowDtos;
import com.autoops.workflow.entity.*;
import com.autoops.workflow.repository.WorkflowRepository;
import com.autoops.workflow.repository.WorkflowStepRepository;
import com.autoops.workflow.validation.WorkflowValidator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/** Owned workflow CRUD with optimistic versioning. Saved workflows are always validated. */
@Service
public class WorkflowService {
    private final WorkflowRepository workflows;
    private final WorkflowStepRepository steps;
    private final WorkflowValidator validator;
    private final CommandDefinitionRepository commands;
    private final AuditService audit;
    private final ObjectMapper json;
    @PersistenceContext
    private EntityManager em;

    public WorkflowService(WorkflowRepository workflows, WorkflowStepRepository steps, WorkflowValidator validator,
                           CommandDefinitionRepository commands, AuditService audit, ObjectMapper json) {
        this.workflows = workflows;
        this.steps = steps;
        this.validator = validator;
        this.commands = commands;
        this.audit = audit;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<WorkflowDtos.Summary> list(Long userId) {
        return workflows.findByDeletedAtIsNullOrderByUpdatedAtDesc().stream()
                .map(w -> new WorkflowDtos.Summary(w.getId(), w.getName(), w.getDescription(), w.getStatus(),
                        steps.findByWorkflowIdAndRetiredAtIsNullOrderByPositionAsc(w.getId()).size(), w.getVersion(), w.getUpdatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkflowDtos.WorkflowView get(Long userId, Long id) {
        return view(requireOwned(userId, id));
    }

    @Transactional(readOnly = true)
    public Workflow requireOwned(Long userId, Long id) {
        return workflows.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound("Workflow"));
    }

    @Transactional(readOnly = true)
    public WorkflowDtos.ValidationResult validate(Long userId, WorkflowDtos.Save draft) {
        return validator.validate(draft, userId);
    }

    @Transactional
    public WorkflowDtos.WorkflowView create(Long userId, WorkflowDtos.Save draft) {
        validator.validateOrThrow(draft, userId);
        Workflow w = new Workflow();
        w.setName(draft.name().trim());
        w.setDescription(blankToNull(draft.description()));
        w.setCreatedBy(userId);
        w.setStatus("ACTIVE");
        w = workflows.save(w);
        writeSteps(w, draft.nodes());
        audit.record(userId, "WORKFLOW_CREATED", "WORKFLOW", w.getId(), Map.of("name", w.getName(), "steps", draft.nodes().size()));
        em.flush();
        return view(w);
    }

    @Transactional
    public WorkflowDtos.WorkflowView update(Long userId, Long id, WorkflowDtos.Save draft) {
        Workflow w = requireOwned(userId, id);
        if (draft.version() != null && !draft.version().equals(w.getVersion())) {
            throw ApiException.conflict("STALE_VERSION", "This workflow was changed elsewhere. Reload it before saving.");
        }
        validator.validateOrThrow(draft, userId);
        w.setName(draft.name().trim());
        w.setDescription(blankToNull(draft.description()));
        w.setUpdatedAt(Instant.now());
        writeSteps(w, draft.nodes());
        w = workflows.save(w);
        em.flush();
        audit.record(userId, "WORKFLOW_UPDATED", "WORKFLOW", w.getId(), Map.of("name", w.getName(), "steps", draft.nodes().size()));
        return view(w);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Workflow w = requireOwned(userId, id);
        long active = ((Number) em.createNativeQuery("select count(*) from executions where workflow_id = :id and status in ('PENDING','RUNNING','WAITING_APPROVAL')")
                .setParameter("id", id).getSingleResult()).longValue();
        if (active > 0) {
            throw ApiException.conflict("WORKFLOW_RUNNING", "Workflow has an execution in progress");
        }
        w.setDeletedAt(Instant.now());
        workflows.save(w);
        audit.record(userId, "WORKFLOW_DELETED", "WORKFLOW", id, Map.of("name", w.getName()));
    }

    @Transactional
    public WorkflowDtos.WorkflowView duplicate(Long userId, Long id) {
        var source = get(userId, id);
        String name = source.name().length() > 190 ? source.name().substring(0, 190) : source.name();
        return create(userId, new WorkflowDtos.Save(name + " (copy)", source.description(), source.nodes(), null));
    }

    /**
     * Applies nodes by key: same key and type updates in place; removed or re-typed steps are deleted, or retired when
     * execution history references them (history stays intact).
     */
    private void writeSteps(Workflow w, List<WorkflowDtos.Node> nodes) {
        Map<String, WorkflowStep> existing = new HashMap<>();
        steps.findByWorkflowIdAndRetiredAtIsNullOrderByPositionAsc(w.getId()).forEach(s -> existing.put(s.getStepKey(), s));
        // Clear every edge first so steps can be removed regardless of the old graph shape.
        steps.findByWorkflowId(w.getId()).forEach(s -> {
            s.setSuccessNextStepId(null);
            s.setFailureNextStepId(null);
        });
        steps.flush();
        Map<String, WorkflowStep> saved = new LinkedHashMap<>();
        int pos = 0;
        for (WorkflowDtos.Node n : nodes) {
            WorkflowStep s = existing.remove(n.key());
            String type = n.normalizedType();
            if (s != null && !s.type().equals(type)) {
                retireOrDelete(s);
                s = null;
            }
            if (s == null) {
                s = switch (type) {
                    case "COMMAND" -> new CommandStep();
                    case "FILE_TRANSFER" -> new FileTransferStep();
                    default -> new WaitUntilStep();
                };
                s.setWorkflowId(w.getId());
                s.setStepKey(n.key());
            }
            apply(s, n, pos++);
            saved.put(n.key(), steps.save(s));
        }
        existing.values().forEach(this::retireOrDelete);
        steps.flush();
        for (WorkflowDtos.Node n : nodes) {
            WorkflowStep s = saved.get(n.key());
            s.setSuccessNextStepId(n.successNext() == null || n.successNext().isBlank() ? null : saved.get(n.successNext()).getId());
            s.setFailureNextStepId(n.failureNext() == null || n.failureNext().isBlank() ? null : saved.get(n.failureNext()).getId());
            steps.save(s);
        }
    }

    private void retireOrDelete(WorkflowStep s) {
        if (steps.hasRuns(s.getId())) {
            s.setRetiredAt(Instant.now());
            s.setStepKey(s.getStepKey().length() > 40 ? s.getStepKey().substring(0, 40) : s.getStepKey());
            s.setStepKey("retired-" + s.getId() + "-" + s.getStepKey());
            steps.save(s);
        } else {
            steps.delete(s);
        }
    }

    private void apply(WorkflowStep s, WorkflowDtos.Node n, int position) {
        s.setName(n.name().trim());
        s.setDescription(blankToNull(n.description()));
        s.setPosition(position);
        s.setRequiresApproval(Boolean.TRUE.equals(n.requiresApproval()));
        switch (s) {
            case CommandStep c -> {
                c.setCommandDefinitionId(n.commandDefinitionId());
                c.setCommandTemplate(commands.findById(n.commandDefinitionId()).map(x -> x.getCommandTemplate()).orElse(null));
                c.setParameters(write(n.parameters()));
                c.setRunWithSudo(Boolean.TRUE.equals(n.runWithSudo()));
                c.setTimeoutSeconds(n.timeoutSeconds());
            }
            case FileTransferStep f -> {
                f.setStoredFileId(n.storedFileId());
                f.setDestinationPath(n.destinationPath().trim());
                f.setOverwrite(Boolean.TRUE.equals(n.overwrite()));
                f.setUseSudo(Boolean.TRUE.equals(n.useSudo()));
                f.setTimeoutSeconds(n.timeoutSeconds());
            }
            case WaitUntilStep x -> {
                x.setCheckType(n.checkType());
                boolean usesCommand = "OUTPUT_CONTAINS".equals(n.checkType()) || "EXIT_CODE".equals(n.checkType());
                x.setCommandDefinitionId(usesCommand ? n.commandDefinitionId() : null);
                x.setParameters(usesCommand ? write(n.parameters()) : null);
                x.setExpectedOutput("OUTPUT_CONTAINS".equals(n.checkType()) ? n.expectedOutput() : null);
                x.setExpectedExitCode("EXIT_CODE".equals(n.checkType()) ? (n.expectedExitCode() == null ? 0 : n.expectedExitCode()) : null);
                x.setTarget(usesCommand ? null : n.target().trim());
                x.setRunWithSudo(Boolean.TRUE.equals(n.runWithSudo()));
                x.setCheckIntervalSeconds(n.intervalSeconds());
                x.setTimeoutSeconds(n.timeoutSeconds());
            }
            default -> throw new IllegalStateException();
        }
    }

    public WorkflowDtos.WorkflowView view(Workflow w) {
        List<WorkflowStep> list = steps.findByWorkflowIdAndRetiredAtIsNullOrderByPositionAsc(w.getId());
        Map<Long, String> keys = new HashMap<>();
        list.forEach(s -> keys.put(s.getId(), s.getStepKey()));
        List<WorkflowDtos.Node> nodes = list.stream().map(s -> node(s, keys)).toList();
        return new WorkflowDtos.WorkflowView(w.getId(), w.getName(), w.getDescription(), w.getStatus(), w.getVersion(), w.getCreatedAt(), w.getUpdatedAt(), nodes);
    }

    private WorkflowDtos.Node node(WorkflowStep s, Map<Long, String> keys) {
        String ok = keys.get(s.getSuccessNextStepId());
        String fail = keys.get(s.getFailureNextStepId());
        return switch (s) {
            case CommandStep c -> new WorkflowDtos.Node(s.getStepKey(), "COMMAND", s.getName(), s.getDescription(), s.isRequiresApproval(), ok, fail,
                    c.getCommandDefinitionId(), read(c.getParameters()), c.isRunWithSudo(), c.getTimeoutSeconds(), null, null, null, null,
                    null, null, null, null, null);
            case FileTransferStep f -> new WorkflowDtos.Node(s.getStepKey(), "FILE_TRANSFER", s.getName(), s.getDescription(), s.isRequiresApproval(), ok, fail,
                    null, null, null, f.getTimeoutSeconds(), f.getStoredFileId(), f.getDestinationPath(), f.isOverwrite(), f.isUseSudo(),
                    null, null, null, null, null);
            case WaitUntilStep x -> new WorkflowDtos.Node(s.getStepKey(), "WAIT_UNTIL", s.getName(), s.getDescription(), s.isRequiresApproval(), ok, fail,
                    x.getCommandDefinitionId(), read(x.getParameters()), x.isRunWithSudo(), x.getTimeoutSeconds(), null, null, null, null,
                    x.getCheckType(), x.getExpectedOutput(), x.getExpectedExitCode(), x.getTarget(), x.getCheckIntervalSeconds());
            default -> throw new IllegalStateException();
        };
    }

    public Map<String, String> read(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return json.readValue(raw, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String write(Map<String, String> params) {
        try {
            return json.writeValueAsString(params == null ? Map.of() : params);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
