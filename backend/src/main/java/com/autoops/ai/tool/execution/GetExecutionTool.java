package com.autoops.ai.tool.execution;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.ToolArgs;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.dto.ExecutionDtos;
import com.autoops.execution.service.ExecutionQueryService;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Sanitized execution context for explanations: statuses, preflight results, exit codes and bounded output.
 * No credentials, no hostnames' secrets, no parameters values that could carry sensitive data beyond names.
 */
@Component
public class GetExecutionTool implements AITool {
    private static final int MAX_OUTPUT = 2000;
    private final ExecutionQueryService queries;

    public GetExecutionTool(ExecutionQueryService queries) {
        this.queries = queries;
    }

    public String name() { return "get_execution"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() {
        return "Get the status and failure details of one of the user's executions: preflight checks, step statuses, exit codes "
                + "and bounded stdout/stderr. Use it to explain failures. It never re-runs anything.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of("executionId", Map.of("type", "integer")), "required", List.of("executionId"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        // Tools act strictly as the calling user: owner-only visibility, even for Admins.
        ExecutionDtos.Detail d = queries.detail(new AuthenticatedUser(user, "", "USER"), ToolArgs.requireLong(args, "executionId"));
        var s = d.summary();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", s.id());
        out.put("type", s.type());
        out.put("title", s.title());
        out.put("status", s.status());
        out.put("mode", s.mode());
        out.put("riskLevel", s.riskLevel());
        out.put("failureReason", s.failureReason());
        out.put("parameterNames", d.parameters().keySet());
        List<Map<String, Object>> machines = new ArrayList<>();
        for (var m : d.machines()) {
            Map<String, Object> mm = new LinkedHashMap<>();
            mm.put("machine", m.machineName());
            mm.put("status", m.status());
            mm.put("failureReason", m.failureReason());
            if (m.preflight() != null) {
                var p = m.preflight();
                mm.put("preflight", Map.of("status", nz(p.status()), "ssh", nz(p.sshStatus()), "hostVerification", nz(p.hostVerificationStatus()),
                        "authentication", nz(p.authenticationStatus()), "os", nz(p.osStatus()), "sudo", nz(p.sudoStatus()),
                        "files", nz(p.filesStatus()), "parameters", nz(p.parametersStatus()), "failureReason", nz(p.failureReason())));
            }
            List<Map<String, Object>> steps = new ArrayList<>();
            for (var st : m.steps()) {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("step", st.stepName());
                x.put("type", st.stepType());
                x.put("attempt", st.attemptNumber());
                x.put("status", st.status());
                x.put("exitCode", st.exitCode());
                x.put("command", st.resolvedCommand());
                x.put("failureReason", st.failureReason());
                x.put("stdoutTail", tail(st.stdout()));
                x.put("stderrTail", tail(st.stderr()));
                steps.add(x);
            }
            mm.put("steps", steps);
            machines.add(mm);
        }
        out.put("machines", machines);
        return out;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String tail(String s) {
        if (s == null) {
            return "";
        }
        return s.length() <= MAX_OUTPUT ? s : "…" + s.substring(s.length() - MAX_OUTPUT);
    }
}
