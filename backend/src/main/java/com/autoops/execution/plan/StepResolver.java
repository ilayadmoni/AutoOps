package com.autoops.execution.plan;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandService;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.common.error.ApiException;
import com.autoops.files.service.StoredFileService;
import com.autoops.infrastructure.remote.ShellCommands;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * Resolves plan steps into exact commands, re-validating against the current Command Bank (approval status,
 * parameter schema) and file ownership. Called at creation (fail fast), in preflight, and right before execution.
 */
@Service
public class StepResolver {
    private static final Pattern SERVICE = Pattern.compile("^[A-Za-z0-9@._:-]{1,128}$");
    private final CommandService commands;
    private final CommandTemplateService templates;
    private final CommandRiskAnalyzer risk;
    private final StoredFileService files;

    public StepResolver(CommandService commands, CommandTemplateService templates, CommandRiskAnalyzer risk, StoredFileService files) {
        this.commands = commands;
        this.templates = templates;
        this.risk = risk;
        this.files = files;
    }

    public ResolvedStep resolve(PlanStep step, Long ownerId) {
        return switch (step.definition()) {
            case StepDefinition.Command c -> {
                CommandDefinition def = commands.requireRunnable(c.commandDefinitionId());
                String resolved = templates.resolve(def.getCommandTemplate(), commands.specs(def), c.parameters());
                var r = CommandRiskAnalyzer.withSudo(CommandRiskAnalyzer.Risk.valueOf(def.getRiskLevel()), c.runWithSudo());
                yield new ResolvedStep(step, "COMMAND", def.getCommandTemplate(), resolved, r.name(), c.runWithSudo(),
                        bounded(c.timeoutSeconds(), 1, 3600, 300), null, null);
            }
            case StepDefinition.FileTransfer f -> {
                var stored = files.requireUsable(ownerId, f.storedFileId());
                String dest = destination(f.destinationPath(), stored.getOriginalFilename());
                var r = f.useSudo() && f.overwrite() ? CommandRiskAnalyzer.Risk.HIGH : CommandRiskAnalyzer.Risk.MEDIUM;
                yield new ResolvedStep(step, "FILE_TRANSFER", "transfer " + stored.getOriginalFilename(), "transfer -> " + dest,
                        r.name(), f.useSudo(), bounded(f.timeoutSeconds(), 1, 3600, 300),
                        new ResolvedStep.FileSource(stored.getId(), stored.getObjectKey(), stored.getSize(), stored.getChecksum(), stored.getOriginalFilename()),
                        dest);
            }
            case StepDefinition.WaitUntil w -> resolveWait(step, w);
        };
    }

    private ResolvedStep resolveWait(PlanStep step, StepDefinition.WaitUntil w) {
        int timeout = bounded(w.timeoutSeconds(), 1, 3600, 120);
        String original;
        String resolved;
        CommandRiskAnalyzer.Risk r;
        switch (w.checkType() == null ? "" : w.checkType()) {
            case "OUTPUT_CONTAINS", "EXIT_CODE" -> {
                if (w.commandDefinitionId() == null) {
                    throw ApiException.validation("Wait step '" + step.name() + "' needs an approved check command");
                }
                if ("OUTPUT_CONTAINS".equals(w.checkType()) && (w.expectedOutput() == null || w.expectedOutput().isEmpty())) {
                    throw ApiException.validation("Wait step '" + step.name() + "' needs the expected output text");
                }
                CommandDefinition def = commands.requireRunnable(w.commandDefinitionId());
                original = def.getCommandTemplate();
                resolved = templates.resolve(def.getCommandTemplate(), commands.specs(def), w.parameters());
                r = CommandRiskAnalyzer.Risk.valueOf(def.getRiskLevel());
            }
            case "FILE_EXISTS" -> {
                String path = absolutePath(w.target(), "Wait step '" + step.name() + "'");
                original = "test -e {{path}}";
                resolved = "test -e " + ShellCommands.quote(path);
                r = CommandRiskAnalyzer.Risk.LOW;
            }
            case "SERVICE_ACTIVE" -> {
                if (w.target() == null || !SERVICE.matcher(w.target()).matches() || w.target().startsWith("-")) {
                    throw ApiException.validation("Wait step '" + step.name() + "' needs a valid service name");
                }
                original = "systemctl is-active --quiet {{service}}";
                resolved = "systemctl is-active --quiet " + ShellCommands.quote(w.target());
                r = CommandRiskAnalyzer.Risk.LOW;
            }
            default -> throw ApiException.validation("Unsupported wait check type: " + w.checkType());
        }
        if (r != CommandRiskAnalyzer.Risk.LOW) {
            throw ApiException.validation("Wait step '" + step.name() + "' must use a read-only (LOW risk) check command");
        }
        r = CommandRiskAnalyzer.withSudo(r, w.runWithSudo());
        return new ResolvedStep(step, "WAIT_UNTIL", original, resolved, r.name(), w.runWithSudo(), timeout, null, null);
    }

    /** Validates an absolute destination; a trailing slash means "into this directory" and appends the file name. */
    static String destination(String path, String filename) {
        String p = absolutePath(path, "Destination path");
        if (p.endsWith("/")) {
            String safeName = filename.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safeName.isBlank() || safeName.startsWith(".") && safeName.replace(".", "").isEmpty()) {
                safeName = "upload";
            }
            p = p + safeName;
        }
        return p;
    }

    static String absolutePath(String path, String what) {
        if (path == null || path.isBlank()) {
            throw ApiException.validation(what + " is required");
        }
        String p = path.trim();
        if (!p.startsWith("/") || p.length() > 1024 || p.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7f)) {
            throw ApiException.validation(what + " must be an absolute path without control characters");
        }
        for (String part : p.split("/")) {
            if (part.equals("..") || part.equals(".")) {
                throw ApiException.validation(what + " may not contain '.' or '..' segments");
            }
        }
        if (p.equals("/")) {
            throw ApiException.validation(what + " cannot be the root directory");
        }
        return p;
    }

    private static int bounded(int value, int min, int max, int fallback) {
        if (value <= 0) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
    }
}
