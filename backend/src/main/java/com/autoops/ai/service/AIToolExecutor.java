package com.autoops.ai.service;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.AIToolRegistry;
import com.autoops.common.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Executes controlled tools as the calling user. Only READ / VALIDATE / PROPOSE tools exist; failures become structured
 * tool results so the model can explain them instead of the request failing.
 */
@Service
public class AIToolExecutor {
    private static final Logger log = LoggerFactory.getLogger(AIToolExecutor.class);
    private static final Set<AITool.ToolRisk> ALLOWED = Set.of(AITool.ToolRisk.READ, AITool.ToolRisk.VALIDATE, AITool.ToolRisk.PROPOSE);
    private final AIToolRegistry registry;

    public AIToolExecutor(AIToolRegistry registry) {
        this.registry = registry;
    }

    public Object execute(String name, Map<String, Object> args, Long user) {
        AITool tool;
        try {
            tool = registry.require(name);
        } catch (IllegalArgumentException e) {
            return Map.of("error", "Unknown tool '" + name + "'");
        }
        if (!ALLOWED.contains(tool.risk())) {
            return Map.of("error", "Tool is not permitted");
        }
        try {
            return tool.execute(args == null ? Map.of() : args, user);
        } catch (ApiException e) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("error", e.getMessage());
            if (!e.fieldErrors().isEmpty()) {
                out.put("fieldErrors", e.fieldErrors());
            }
            return out;
        } catch (RuntimeException e) {
            log.warn("AI tool {} failed: {}", name, e.getMessage());
            return Map.of("error", "Tool failed");
        }
    }

    public List<Map<String, Object>> schemas() {
        return registry.all().stream().sorted((a, b) -> a.name().compareTo(b.name()))
                .map(t -> Map.<String, Object>of("type", "function", "function",
                        Map.of("name", t.name(), "description", t.description(), "parameters", t.schema())))
                .toList();
    }
}
