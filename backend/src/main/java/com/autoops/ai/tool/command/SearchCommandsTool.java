package com.autoops.ai.tool.command;

import com.autoops.ai.tool.AITool;
import com.autoops.command.retrieval.CommandRetrievalService;
import org.springframework.stereotype.Component;

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
        return "Search the approved Command Bank. Returns candidate commands with id, template, risk and a confidence verdict.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "query", Map.of("type", "string", "description", "What the user wants to do"),
                "category", Map.of("type", "string"),
                "maxRisk", Map.of("type", "string", "enum", List.of("LOW", "MEDIUM", "HIGH"))), "required", List.of("query"));
    }

    public Object execute(Map<String, Object> a, Long user) {
        return search.search(Objects.toString(a.get("query"), ""), (String) a.get("category"), (String) a.get("maxRisk"), user);
    }
}
