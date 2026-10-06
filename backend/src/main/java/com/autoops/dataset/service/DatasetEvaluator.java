package com.autoops.dataset.service;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.command.service.ParameterSpec;
import com.autoops.common.error.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.*;
import java.util.function.Consumer;

/**
 * Evaluates every CSV row: normalization, validation, RHEL applicability, de-duplication (within the file and against
 * the Command Bank) and server-side risk. Used both for the preview and, again, at import time.
 */
@Component
public class DatasetEvaluator {
    private static final java.util.regex.Pattern RHEL = java.util.regex.Pattern.compile(
            "\\b(rhel\\d*|red ?hat|redhat|centos|rocky|alma(linux)?|oracle linux|el\\d+|linux|any|all)\\b");
    private static final java.util.regex.Pattern NON_RHEL = java.util.regex.Pattern.compile(
            "\\b(ubuntu|debian|mint|suse|sles|opensuse|alpine|arch|gentoo|windows|macos|darwin|osx|freebsd|openbsd|solaris|aix|hp-ux)\\b");

    private final CommandTemplateService templates;
    private final CommandRiskAnalyzer risk;
    private final CommandDefinitionRepository commands;
    private final ObjectMapper json;

    public DatasetEvaluator(CommandTemplateService templates, CommandRiskAnalyzer risk, CommandDefinitionRepository commands, ObjectMapper json) {
        this.templates = templates;
        this.risk = risk;
        this.commands = commands;
        this.json = json;
    }

    public record Candidate(long line, String name, String description, String category, String action, String resourceType,
                            String template, List<ParameterSpec> parameters, String risk) {
    }

    public record Issue(long line, String kind, String message) {
    }

    public record Result(DatasetCsvParser.Header header, int total, int invalid, int nonRhel, int duplicates) {
    }

    public Result evaluate(InputStream in, Consumer<Candidate> candidates, Consumer<Issue> issues) {
        Set<String> seen = new HashSet<>();
        int[] counts = new int[4];
        var header = DatasetCsvParser.parse(in, row -> {
            counts[0]++;
            var v = row.values();
            if (!row.consistent()) {
                counts[1]++;
                issues.accept(new Issue(row.line(), "INVALID", "Row has a different number of columns than the header"));
                return;
            }
            String name = v.getOrDefault("name", "").strip();
            String template = v.getOrDefault("command", "").strip();
            if (name.isEmpty() || name.length() > 200) {
                counts[1]++;
                issues.accept(new Issue(row.line(), "INVALID", "Name is required (max 200 characters)"));
                return;
            }
            if (template.isEmpty() || template.length() > 4000) {
                counts[1]++;
                issues.accept(new Issue(row.line(), "INVALID", "Command is required (max 4000 characters)"));
                return;
            }
            String os = v.getOrDefault("os", "").strip().toLowerCase(Locale.ROOT);
            if (!os.isEmpty() && Arrays.stream(os.split("[,;/|]")).map(String::strip).noneMatch(DatasetEvaluator::rhelApplicable)) {
                counts[2]++;
                issues.accept(new Issue(row.line(), "NON_RHEL", "Not applicable to RHEL (" + clip(os) + ")"));
                return;
            }
            List<ParameterSpec> declared = null;
            String rawParams = v.getOrDefault("parameters", "").strip();
            if (!rawParams.isEmpty()) {
                try {
                    declared = json.readValue(rawParams, new TypeReference<List<ParameterSpec>>() {});
                } catch (Exception e) {
                    counts[1]++;
                    issues.accept(new Issue(row.line(), "INVALID", "Parameters column is not a valid JSON parameter list"));
                    return;
                }
            }
            List<ParameterSpec> specs;
            try {
                specs = templates.validateTemplate(template, declared);
            } catch (ApiException e) {
                counts[1]++;
                String detail = e.fieldErrors().isEmpty() ? e.getMessage() : String.join("; ", e.fieldErrors().values());
                issues.accept(new Issue(row.line(), "INVALID", clip(detail)));
                return;
            }
            String normalized = CommandDefinition.normalize(template);
            if (!seen.add(normalized)) {
                counts[3]++;
                issues.accept(new Issue(row.line(), "DUPLICATE", "Duplicate of an earlier row in this file"));
                return;
            }
            if (commands.existsByNormalizedTemplate(normalized)) {
                counts[3]++;
                issues.accept(new Issue(row.line(), "DUPLICATE", "Already in the Command Bank"));
                return;
            }
            candidates.accept(new Candidate(row.line(), name, blankToNull(v.get("description")),
                    v.getOrDefault("category", "").isBlank() ? "IMPORTED" : clip(v.get("category").strip().toUpperCase(Locale.ROOT), 80),
                    blankToNull(v.get("action")), blankToNull(v.get("resource_type")), template, specs, risk.analyze(template).name()));
        });
        return new Result(header, counts[0], counts[1], counts[2], counts[3]);
    }

    static boolean rhelApplicable(String osEntry) {
        return !NON_RHEL.matcher(osEntry).find() && RHEL.matcher(osEntry).find();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : clip(s.strip(), 2000);
    }

    private static String clip(String s) {
        return clip(s, 200);
    }

    private static String clip(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
