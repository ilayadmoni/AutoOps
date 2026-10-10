package com.autoops.ai.tool.command;

import com.autoops.ai.tool.AITool;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.command.service.ParameterSpec;
import com.autoops.common.error.ApiException;
import com.autoops.infrastructure.remote.OsFamily;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Proposes adding a new command to the Command Bank when no approved command fits. Validates the template, its
 * parameters and duplicates server-side and returns a PROPOSE_NEW_COMMAND operation. Nothing is saved here: the user
 * adds it from the proposal, and it is approved on creation.
 */
@Component
public class ProposeNewCommandTool implements AITool {
    private final CommandTemplateService templates;
    private final CommandRiskAnalyzer risk;
    private final CommandDefinitionRepository commands;
    private final ObjectMapper json;

    public ProposeNewCommandTool(CommandTemplateService templates, CommandRiskAnalyzer risk, CommandDefinitionRepository commands, ObjectMapper json) {
        this.templates = templates;
        this.risk = risk;
        this.commands = commands;
        this.json = json;
    }

    public String name() { return "propose_command"; }

    public ToolRisk risk() { return ToolRisk.PROPOSE; }

    public String description() {
        return "Propose adding a NEW Linux command to the Command Bank when search_commands found nothing suitable. "
                + "Use {{name}} placeholders for values the user fills in at run time and declare each in parameters "
                + "(type STRING, INTEGER, PATH, SERVICE, PACKAGE, HOSTNAME or ENUM). Never include sudo. Returns a proposal; nothing is saved.";
    }

    public Map<String, Object> schema() {
        Map<String, Object> param = Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string"), "label", Map.of("type", "string"),
                "type", Map.of("type", "string", "enum", List.of("STRING", "INTEGER", "PATH", "SERVICE", "PACKAGE", "HOSTNAME", "ENUM")),
                "required", Map.of("type", "boolean"), "description", Map.of("type", "string")), "required", List.of("name", "type"));
        return Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string", "description", "Short title, e.g. 'Show open ports'"),
                "description", Map.of("type", "string"),
                "category", Map.of("type", "string", "description", "e.g. FILES, NETWORK, SERVICES, SYSTEM, STORAGE, PACKAGES"),
                "commandTemplate", Map.of("type", "string", "description", "e.g. 'du -sh {{path}}'"),
                "parameters", Map.of("type", "array", "items", param)), "required", List.of("name", "commandTemplate"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        String name = Objects.toString(args.get("name"), "").strip();
        String template = Objects.toString(args.get("commandTemplate"), "").strip();
        if (name.isEmpty() || name.length() > 200) {
            throw ApiException.validation("A command name (max 200 characters) is required");
        }
        List<ParameterSpec> declared;
        try {
            declared = args.get("parameters") == null ? List.of()
                    : json.convertValue(args.get("parameters"), new TypeReference<List<ParameterSpec>>() {});
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("parameters must be a list of {name, type, label, required, description}");
        }
        List<ParameterSpec> specs = templates.validateTemplate(template, declared);
        if (commands.existsByNormalizedTemplate(CommandDefinition.normalize(template))) {
            throw ApiException.conflict("DUPLICATE_COMMAND", "This command already exists in the Command Bank; use search_commands to find it and use it");
        }
        String category = Objects.toString(args.get("category"), "").strip();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", name);
        payload.put("description", Objects.toString(args.get("description"), "").strip());
        payload.put("category", category.isEmpty() ? "SYSTEM" : category.toUpperCase(Locale.ROOT));
        payload.put("commandTemplate", template);
        payload.put("parameters", specs);
        payload.put("riskLevel", risk.analyze(template).name());
        payload.put("supportedOs", OsFamily.format(OsFamily.ofTemplate(template)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("operation", Map.of("type", "PROPOSE_NEW_COMMAND", "payload", payload));
        out.put("requiresUserConfirmation", true);
        out.put("note", "Nothing was saved. Tell the user a card is ready and they add it with 'Add to Command Bank'.");
        return out;
    }
}
