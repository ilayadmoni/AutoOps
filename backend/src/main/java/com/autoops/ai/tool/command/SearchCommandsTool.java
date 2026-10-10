package com.autoops.ai.tool.command;

import com.autoops.ai.tool.AITool;
import com.autoops.command.retrieval.CommandRetrievalService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class SearchCommandsTool implements AITool {
    private final CommandRetrievalService search;

    public SearchCommandsTool(CommandRetrievalService search) {
        this.search = search;
    }

    public String name() { return "search_commands"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() {
        return "Search the approved Command Bank by the general action (e.g. 'restart service', 'disk usage'). Returns candidate "
                + "commands with id, template, risk and a confidence verdict. The verdict is only a hint: read the candidates' names "
                + "and templates and use one whose template does what the user wants, filling its {{parameters}} "
                + "(e.g. 'Restart service' with service=nginx for 'restart nginx').";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "query", Map.of("type", "string", "description", "What the user wants to do"),
                "category", Map.of("type", "string"),
                "maxRisk", Map.of("type", "string", "enum", List.of("LOW", "MEDIUM", "HIGH"))), "required", List.of("query"));
    }

    public Object execute(Map<String, Object> a, Long user) {
        var result = search.search(Objects.toString(a.get("query"), ""), (String) a.get("category"), (String) a.get("maxRisk"), user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("confidence", result.confidence());
        out.put("matches", result.matches());
        out.put("note", result.matches().isEmpty() ? "No approved command matches."
                : "Candidates are ranked best first. Use a candidate only if its template itself performs the requested action. "
                + "Never pass a command line as a parameter value of a generic wrapper (env, bash, sh, sudo, xargs, nohup...).");
        return out;
    }
}
