package com.autoops.ai.tool.machine;

import com.autoops.ai.tool.AITool;
import com.autoops.machine.service.MachineService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Lists the caller's machines with safe, non-secret fields only. */
@Component
public class ListMachinesTool implements AITool {
    private final MachineService machines;

    public ListMachinesTool(MachineService machines) {
        this.machines = machines;
    }

    public String name() { return "list_machines"; }

    public ToolRisk risk() { return ToolRisk.READ; }

    public Map<String, Object> schema() { return Map.of("type", "object", "properties", Map.of()); }

    public Object execute(Map<String, Object> args, Long user) {
        List<Map<String, Object>> out = machines.list(user).stream().map(m -> {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", m.id());
            x.put("name", m.name());
            x.put("hostname", m.hostname());
            x.put("sshPort", m.sshPort());
            x.put("operatingSystem", m.operatingSystem());
            x.put("trustStatus", m.trustStatus());
            x.put("hasPreferredCredential", m.preferredCredentialId() != null);
            return x;
        }).toList();
        return Map.of("machines", out);
    }
}
