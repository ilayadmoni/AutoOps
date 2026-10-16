package com.autoops.execution.plan;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandService;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.common.error.ApiException;
import com.autoops.files.service.StoredFileService;
import com.autoops.infrastructure.remote.OsFamily;
import com.autoops.infrastructure.remote.ShellCommands;
import org.springframework.stereotype.Service;

import java.util.Set;
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

    private static final Set<OsFamily> ANY_LINUX = Set.of(OsFamily.LINUX);

    public ResolvedStep resolve(PlanStep step, Long ownerId) {
        return switch (step.definition()) {
            case StepDefinition.Command c when c.customCommand() != null -> {
                // A step's own command: run exactly as written; risk comes from the text, so HIGH still gates the run.
                var r = CommandRiskAnalyzer.withSudo(risk.analyze(c.customCommand()), c.runWithSudo());
                yield new ResolvedStep(step, "COMMAND", c.customCommand(), c.customCommand(), r.name(), c.runWithSudo(),
                        bounded(c.timeoutSeconds(), 1, 3600, 300), null, null, ANY_LINUX);
            }
            case StepDefinition.Command c -> {
                CommandDefinition def = commands.requireRunnable(c.commandDefinitionId());
                String resolved = templates.resolve(def.getCommandTemplate(), commands.specs(def), c.parameters());
                var r = CommandRiskAnalyzer.withSudo(CommandRiskAnalyzer.Risk.valueOf(def.getRiskLevel()), c.runWithSudo());
                yield new ResolvedStep(step, "COMMAND", def.getCommandTemplate(), resolved, r.name(), c.runWithSudo(),
                        bounded(c.timeoutSeconds(), 1, 3600, 300), null, null, OsFamily.parseStored(def.getSupportedOs()));
            }
            case StepDefinition.FileTransfer f -> {
                var stored = files.requireUsable(ownerId, f.storedFileId());
                boolean folder = stored.getFolderName() != null;
                String dest = folder ? absolutePath(f.destinationPath(), "Destination directory").replaceAll("/+$", "") : destination(f.destinationPath(), stored.getOriginalFilename());
                var r = (folder || f.useSudo()) && f.overwrite() ? CommandRiskAnalyzer.Risk.HIGH : CommandRiskAnalyzer.Risk.MEDIUM;
                yield new ResolvedStep(step, "FILE_TRANSFER", (folder ? "deploy folder " : "transfer ") + stored.getOriginalFilename(), "transfer -> " + dest,
                        r.name(), f.useSudo(), bounded(f.timeoutSeconds(), 1, 3600, 300),
                        new ResolvedStep.FileSource(stored.getId(), stored.getObjectKey(), stored.getSize(), stored.getChecksum(), stored.getOriginalFilename()),
                        dest, ANY_LINUX);
            }
            case StepDefinition.WaitUntil w -> resolveWait(step, w);
        };
    }

    private ResolvedStep resolveWait(PlanStep step, StepDefinition.WaitUntil w) {
        int timeout = bounded(w.timeoutSeconds(), 1, 3600, 120);
        String original;
        String resolved;
        CommandRiskAnalyzer.Risk r;
        Set<OsFamily> supported = ANY_LINUX;
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
                supported = OsFamily.parseStored(def.getSupportedOs());
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
        return new ResolvedStep(step, "WAIT_UNTIL", original, resolved, r.name(), w.runWithSudo(), timeout, null, null, supported);
    }

    static String destination(String path, String filename) { return TransferPaths.destination(path, filename); }
    static String absolutePath(String path, String what) { return TransferPaths.absolutePath(path, what); }

    private static int bounded(int value, int min, int max, int fallback) {
        if (value <= 0) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
    }
}
