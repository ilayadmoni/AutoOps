package com.autoops.command.service;

import com.autoops.common.error.ApiException;
import com.autoops.infrastructure.remote.ShellCommands;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validates command templates and parameters, and resolves templates server-side. Parameter values are always
 * type-checked and inserted as single shell words (POSIX single-quoted); clients never supply resolved commands.
 */
@Service
public class CommandTemplateService {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([A-Za-z_][A-Za-z0-9_]{0,63})\\s*}}");
    private static final Pattern SUDO = Pattern.compile("(^|[\\s;&|(`$])sudo(\\s|$)");
    private static final Pattern SERVICE = Pattern.compile("^[A-Za-z0-9@._:-]{1,128}$");
    private static final Pattern PACKAGE = Pattern.compile("^[A-Za-z0-9._+:~-]{1,128}$");
    private static final Pattern HOST = Pattern.compile("^[A-Za-z0-9.:-]{1,253}$");
    private static final Pattern INTEGER = Pattern.compile("^-?\\d{1,10}$");
    private static final int MAX_VALUE = 1024;

    private final ObjectMapper json;

    public CommandTemplateService(ObjectMapper json) {
        this.json = json;
    }

    public Set<String> placeholders(String template) {
        Set<String> names = new LinkedHashSet<>();
        Matcher m = PLACEHOLDER.matcher(template);
        while (m.find()) {
            names.add(m.group(1));
        }
        return names;
    }

    /** Validates a template and its declared parameters, returning the normalized parameter list to store. */
    public List<ParameterSpec> validateTemplate(String template, List<ParameterSpec> declared) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (template == null || template.isBlank()) {
            errors.put("commandTemplate", "Command template is required");
        } else {
            if (template.indexOf('\0') >= 0) {
                errors.put("commandTemplate", "Template contains invalid characters");
            }
            if (SUDO.matcher(template).find()) {
                errors.put("commandTemplate", "Do not include sudo in templates; privilege escalation is chosen per run");
            }
            String stripped = PLACEHOLDER.matcher(template).replaceAll("");
            if (stripped.contains("{{") || stripped.contains("}}")) {
                errors.put("commandTemplate", "Malformed placeholder; use {{name}} with letters, digits and underscores");
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.validation("Invalid command template", errors);
        }
        Set<String> names = placeholders(template);
        List<ParameterSpec> specs = new ArrayList<>();
        Map<String, ParameterSpec> byName = new LinkedHashMap<>();
        if (declared != null) {
            for (ParameterSpec p : declared) {
                if (byName.put(p.name(), p.normalized()) != null) {
                    errors.put("parameters", "Duplicate parameter " + p.name());
                }
                if ("ENUM".equals(p.typeOrDefault()) && (p.allowedValues() == null || p.allowedValues().isEmpty())) {
                    errors.put("parameters", "ENUM parameter " + p.name() + " needs allowedValues");
                }
            }
        }
        for (String n : byName.keySet()) {
            if (!names.contains(n)) {
                errors.put("parameters", "Parameter " + n + " is not used in the template");
            }
        }
        for (String n : names) {
            specs.add(byName.getOrDefault(n, new ParameterSpec(n, n, "STRING", true, null, List.of(), null).normalized()));
        }
        if (!errors.isEmpty()) {
            throw ApiException.validation("Invalid command parameters", errors);
        }
        return specs;
    }

    public List<ParameterSpec> parse(String schemaJson, String template) {
        if (schemaJson != null && !schemaJson.isBlank()) {
            try {
                List<ParameterSpec> list = json.readValue(schemaJson, new TypeReference<List<ParameterSpec>>() {});
                return list.stream().map(ParameterSpec::normalized).toList();
            } catch (Exception ignored) {
                // Fall through to placeholder-derived parameters.
            }
        }
        return placeholders(template).stream().map(n -> new ParameterSpec(n, n, "STRING", true, null, List.of(), null)).toList();
    }

    public String serialize(List<ParameterSpec> specs) {
        try {
            return json.writeValueAsString(specs);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Type-checks values and returns them with defaults applied. Field-specific errors are reported. */
    public Map<String, String> validateValues(List<ParameterSpec> specs, Map<String, String> values) {
        Map<String, String> in = values == null ? Map.of() : values;
        Map<String, String> errors = new LinkedHashMap<>();
        Map<String, String> out = new LinkedHashMap<>();
        Set<String> known = new HashSet<>();
        for (ParameterSpec spec : specs) {
            known.add(spec.name());
            String v = in.get(spec.name());
            if ((v == null || v.isEmpty()) && spec.defaultValue() != null && !spec.defaultValue().isEmpty()) {
                v = spec.defaultValue();
            }
            if (v == null || v.isEmpty()) {
                if (spec.isRequired()) {
                    errors.put(spec.name(), "Required");
                }
                continue;
            }
            String problem = check(spec, v);
            if (problem != null) {
                errors.put(spec.name(), problem);
            } else {
                out.put(spec.name(), v);
            }
        }
        for (String k : in.keySet()) {
            if (!known.contains(k)) {
                errors.put(k, "Unknown parameter");
            }
        }
        if (!errors.isEmpty()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_PARAMETERS", "Command parameters are invalid", errors);
        }
        return out;
    }

    private static String check(ParameterSpec spec, String v) {
        if (v.length() > MAX_VALUE) {
            return "Too long";
        }
        if (v.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7f)) {
            return "Control characters are not allowed";
        }
        if (v.startsWith("-")) {
            return "Values may not start with '-'";
        }
        return switch (spec.typeOrDefault()) {
            case "INTEGER" -> INTEGER.matcher(v).matches() ? null : "Must be an integer";
            case "PATH" -> v.contains("..") ? "Parent directory references are not allowed" : null;
            case "SERVICE" -> SERVICE.matcher(v).matches() ? null : "Invalid service name";
            case "PACKAGE" -> PACKAGE.matcher(v).matches() ? null : "Invalid package name";
            case "HOSTNAME" -> HOST.matcher(v).matches() ? null : "Invalid hostname or IP";
            case "ENUM" -> spec.allowedValues() != null && spec.allowedValues().contains(v) ? null : "Must be one of " + spec.allowedValues();
            default -> v.length() > 256 ? "Too long" : null;
        };
    }

    /** Resolves a template with validated values. Every value becomes exactly one quoted shell word. */
    public String resolve(String template, List<ParameterSpec> specs, Map<String, String> values) {
        Map<String, String> valid = validateValues(specs, values);
        Matcher m = PLACEHOLDER.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String v = valid.get(m.group(1));
            if (v == null) {
                throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "INVALID_PARAMETERS",
                        "Command parameters are invalid", Map.of(m.group(1), "Required"));
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(ShellCommands.quote(v)));
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
