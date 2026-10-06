package com.autoops.ai.tool.machine;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.ToolArgs;
import com.autoops.machine.service.MachineService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GetMachineTool implements AITool {
    private final MachineService machines;

    public GetMachineTool(MachineService machines) {
        this.machines = machines;
    }

    public String name() { return "get_machine"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public String description() { return "Get one of the user's machines: name, host, OS, SSH trust status and last connection test."; }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of("machineId", Map.of("type", "integer")), "required", List.of("machineId"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        var m = machines.get(user, ToolArgs.requireLong(args, "machineId"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.id());
        out.put("name", m.name());
        out.put("hostname", m.hostname());
        out.put("sshPort", m.sshPort());
        out.put("operatingSystem", m.operatingSystem());
        out.put("osVersion", m.osVersion());
        out.put("trustStatus", m.trustStatus());
        out.put("hostKeyAlgorithm", m.hostKeyAlgorithm());
        out.put("hasPreferredCredential", m.preferredCredentialId() != null);
        out.put("lastTestStatus", m.lastTestStatus());
        out.put("lastTestedAt", m.lastTestedAt());
        return out;
    }
}
