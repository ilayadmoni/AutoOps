package com.autoops.ai.tool.execution;

import com.autoops.ai.tool.AITool;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.service.ExecutionQueryService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ListRecentExecutionsTool implements AITool {
    private final ExecutionQueryService queries;

    public ListRecentExecutionsTool(ExecutionQueryService queries) {
        this.queries = queries;
    }

    public String name() { return "list_recent_executions"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() { return "List the user's 10 most recent executions with status, so a failing one can be inspected with get_execution."; }

    public Map<String, Object> schema() { return Map.of("type", "object", "properties", Map.of()); }

    public Object execute(Map<String, Object> args, Long user) {
        var page = queries.list(new AuthenticatedUser(user, "", "USER"), false, 0, 10);
        return Map.of("executions", page.items().stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.id());
            m.put("type", s.type());
            m.put("title", s.title());
            m.put("status", s.status());
            m.put("riskLevel", s.riskLevel());
            m.put("machines", s.machineCount());
            m.put("failedMachines", s.failedMachines());
            m.put("startedAt", s.startedAt());
            return m;
        }).toList());
    }
}
