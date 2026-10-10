package com.autoops.workflow.validation;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.service.CommandService;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.common.error.ApiException;
import com.autoops.files.repository.StoredFileRepository;
import com.autoops.workflow.dto.WorkflowDtos;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Validates a workflow draft before it is saved: graph structure (keys, edges, acyclic, reachable), supported node
 * types, bounded timing, typed configuration, command references and file ownership. Errors are node/field specific.
 */
@Service
public class WorkflowValidator {
    public static final Set<String> TYPES = Set.of("COMMAND", "FILE_TRANSFER", "WAIT_UNTIL");
    public static final Set<String> CHECKS = Set.of("OUTPUT_CONTAINS", "EXIT_CODE", "FILE_EXISTS", "SERVICE_ACTIVE");
    private static final Pattern KEY = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final Pattern SERVICE = Pattern.compile("^[A-Za-z0-9@._:-]{1,128}$");

    private final CommandDefinitionRepository commandRepo;
    private final CommandService commands;
    private final CommandTemplateService templates;
    private final StoredFileRepository files;

    public WorkflowValidator(CommandDefinitionRepository commandRepo, CommandService commands, CommandTemplateService templates, StoredFileRepository files) {
        this.commandRepo = commandRepo;
        this.commands = commands;
        this.templates = templates;
        this.files = files;
    }

    public WorkflowDtos.ValidationResult validate(WorkflowDtos.Save draft, Long userId) {
        List<WorkflowDtos.ValidationError> errors = new ArrayList<>();
        if (draft.name() == null || draft.name().isBlank()) {
            errors.add(new WorkflowDtos.ValidationError(null, "name", "Name is required"));
        }
        List<WorkflowDtos.Node> nodes = draft.nodes() == null ? List.of() : draft.nodes();
        if (nodes.isEmpty()) {
            errors.add(new WorkflowDtos.ValidationError(null, "nodes", "A workflow needs at least one step"));
            return new WorkflowDtos.ValidationResult(false, errors);
        }
        Map<String, WorkflowDtos.Node> byKey = new LinkedHashMap<>();
        for (WorkflowDtos.Node n : nodes) {
            if (n.key() == null || !KEY.matcher(n.key()).matches()) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "key", "Each step needs a key of 1-64 letters, digits, '-' or '_'"));
                continue;
            }
            if (byKey.put(n.key(), n) != null) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "key", "Duplicate step key"));
            }
        }
        for (WorkflowDtos.Node n : nodes) {
            if (n.key() == null) {
                continue;
            }
            if (n.name() == null || n.name().isBlank() || n.name().length() > 200) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "name", "Step name is required (max 200 characters)"));
            }
            for (String[] edge : new String[][]{{"successNext", n.successNext()}, {"failureNext", n.failureNext()}}) {
                if (edge[1] != null && !edge[1].isBlank()) {
                    if (!byKey.containsKey(edge[1])) {
                        errors.add(new WorkflowDtos.ValidationError(n.key(), edge[0], "Points to an unknown step"));
                    } else if (edge[1].equals(n.key())) {
                        errors.add(new WorkflowDtos.ValidationError(n.key(), edge[0], "A step cannot point to itself"));
                    }
                }
            }
            String type = n.normalizedType();
            if (type == null || !TYPES.contains(type)) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "type", "Unsupported step type"));
                continue;
            }
            switch (type) {
                case "COMMAND" -> validateCommand(n, userId, errors);
                case "FILE_TRANSFER" -> validateFile(n, userId, errors);
                case "WAIT_UNTIL" -> validateWait(n, userId, errors);
                default -> { }
            }
        }
        if (errors.stream().noneMatch(e -> "successNext".equals(e.field()) || "failureNext".equals(e.field()) || "key".equals(e.field()))) {
            graph(nodes, byKey, errors);
        }
        return new WorkflowDtos.ValidationResult(errors.isEmpty(), errors);
    }

    public void validateOrThrow(WorkflowDtos.Save draft, Long userId) {
        var r = validate(draft, userId);
        if (!r.valid()) {
            Map<String, String> fields = new LinkedHashMap<>();
            r.errors().forEach(e -> fields.putIfAbsent((e.nodeKey() == null ? "" : "nodes." + e.nodeKey() + ".") + e.field(), e.message()));
            throw ApiException.validation("Workflow is invalid: " + r.errors().get(0).message(), fields);
        }
    }

    private void graph(List<WorkflowDtos.Node> nodes, Map<String, WorkflowDtos.Node> byKey, List<WorkflowDtos.ValidationError> errors) {
        // Cycle detection (V1 workflows are acyclic) via iterative DFS colouring.
        Map<String, Integer> color = new HashMap<>();
        for (String start : byKey.keySet()) {
            if (color.getOrDefault(start, 0) != 0) {
                continue;
            }
            Deque<Iterator<String>> stack = new ArrayDeque<>();
            Deque<String> path = new ArrayDeque<>();
            color.put(start, 1);
            path.push(start);
            stack.push(next(byKey.get(start)).iterator());
            while (!stack.isEmpty()) {
                Iterator<String> it = stack.peek();
                if (it.hasNext()) {
                    String n = it.next();
                    int c = color.getOrDefault(n, 0);
                    if (c == 1) {
                        errors.add(new WorkflowDtos.ValidationError(path.peek(), "edges", "Creates a cycle back to step '" + byKey.get(n).name() + "'; cycles are not supported"));
                        return;
                    }
                    if (c == 0) {
                        color.put(n, 1);
                        path.push(n);
                        stack.push(next(byKey.get(n)).iterator());
                    }
                } else {
                    stack.pop();
                    color.put(path.pop(), 2);
                }
            }
        }
        // Every step must be reachable from the first one.
        Set<String> seen = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>(List.of(nodes.get(0).key()));
        while (!queue.isEmpty()) {
            String k = queue.poll();
            if (seen.add(k)) {
                queue.addAll(next(byKey.get(k)));
            }
        }
        for (WorkflowDtos.Node n : nodes) {
            if (!seen.contains(n.key())) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "edges", "Step is not reachable from the first step"));
            }
        }
    }

    private static List<String> next(WorkflowDtos.Node n) {
        List<String> out = new ArrayList<>(2);
        if (n.successNext() != null && !n.successNext().isBlank()) {
            out.add(n.successNext());
        }
        if (n.failureNext() != null && !n.failureNext().isBlank() && !n.failureNext().equals(n.successNext())) {
            out.add(n.failureNext());
        }
        return out;
    }

    private void validateCommand(WorkflowDtos.Node n, Long userId, List<WorkflowDtos.ValidationError> errors) {
        CommandDefinition c = visibleCommand(n, userId, errors);
        if (c != null) {
            parameters(n, c, errors);
        }
        timeout(n, n.timeoutSeconds(), errors);
    }

    private void validateFile(WorkflowDtos.Node n, Long userId, List<WorkflowDtos.ValidationError> errors) {
        if (n.storedFileId() == null) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "storedFileId", "Select an uploaded file"));
        } else if (files.findByIdAndDeletedAtIsNull(n.storedFileId()).isEmpty()) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "storedFileId", "File not found"));
        }
        String p = n.destinationPath();
        if (p == null || p.isBlank()) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "destinationPath", "Destination path is required"));
        } else if (!p.startsWith("/") || p.equals("/") || p.length() > 1024 || p.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7f)
                || Arrays.stream(p.split("/")).anyMatch(s -> s.equals("..") || s.equals("."))) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "destinationPath", "Use an absolute path without '.' or '..' segments"));
        }
        timeout(n, n.timeoutSeconds(), errors);
    }

    private void validateWait(WorkflowDtos.Node n, Long userId, List<WorkflowDtos.ValidationError> errors) {
        String check = n.checkType();
        if (check == null || !CHECKS.contains(check)) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "checkType", "Choose OUTPUT_CONTAINS, EXIT_CODE, FILE_EXISTS or SERVICE_ACTIVE"));
        } else if (check.equals("OUTPUT_CONTAINS") || check.equals("EXIT_CODE")) {
            CommandDefinition c = visibleCommand(n, userId, errors);
            if (c != null) {
                if (!"LOW".equals(c.getRiskLevel())) {
                    errors.add(new WorkflowDtos.ValidationError(n.key(), "commandDefinitionId", "Wait checks must use a read-only (LOW risk) command"));
                }
                parameters(n, c, errors);
            }
            if (check.equals("OUTPUT_CONTAINS") && (n.expectedOutput() == null || n.expectedOutput().isEmpty() || n.expectedOutput().length() > 500)) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "expectedOutput", "Expected text is required (max 500 characters)"));
            }
            if (check.equals("EXIT_CODE") && n.expectedExitCode() != null && (n.expectedExitCode() < 0 || n.expectedExitCode() > 255)) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "expectedExitCode", "Exit code must be 0-255"));
            }
        } else if (check.equals("FILE_EXISTS")) {
            String p = n.target();
            if (p == null || !p.startsWith("/") || p.length() > 1024 || p.chars().anyMatch(ch -> ch < 0x20)
                    || Arrays.stream(p.split("/")).anyMatch(s -> s.equals(".."))) {
                errors.add(new WorkflowDtos.ValidationError(n.key(), "target", "Enter an absolute file path"));
            }
        } else if (n.target() == null || !SERVICE.matcher(n.target()).matches() || n.target().startsWith("-")) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "target", "Enter a valid service name"));
        }
        Integer interval = n.intervalSeconds();
        if (interval == null || interval < 1 || interval > 300) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "intervalSeconds", "Interval must be 1-300 seconds"));
        }
        timeout(n, n.timeoutSeconds(), errors);
        if (interval != null && n.timeoutSeconds() != null && interval > n.timeoutSeconds()) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "intervalSeconds", "Interval cannot exceed the timeout"));
        }
    }

    private CommandDefinition visibleCommand(WorkflowDtos.Node n, Long userId, List<WorkflowDtos.ValidationError> errors) {
        if (n.commandDefinitionId() == null) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "commandDefinitionId", "Select a command from the Command Bank"));
            return null;
        }
        var c = commandRepo.findById(n.commandDefinitionId()).orElse(null);
        if (c == null || (!c.isApproved() && !userId.equals(c.getCreatedBy()))) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "commandDefinitionId", "Command not found"));
            return null;
        }
        if (CommandDefinition.REJECTED.equals(c.getStatus())) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "commandDefinitionId", "Command was rejected and cannot be used"));
            return null;
        }
        return c;
    }

    private void parameters(WorkflowDtos.Node n, CommandDefinition c, List<WorkflowDtos.ValidationError> errors) {
        try {
            templates.validateValues(commands.specs(c), n.parameters());
        } catch (ApiException e) {
            e.fieldErrors().forEach((k, v) -> errors.add(new WorkflowDtos.ValidationError(n.key(), "parameters." + k, v)));
        }
    }

    private static void timeout(WorkflowDtos.Node n, Integer t, List<WorkflowDtos.ValidationError> errors) {
        if (t == null || t < 1 || t > 3600) {
            errors.add(new WorkflowDtos.ValidationError(n.key(), "timeoutSeconds", "Timeout must be 1-3600 seconds"));
        }
    }
}
