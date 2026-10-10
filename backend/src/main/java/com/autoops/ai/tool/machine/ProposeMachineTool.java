package com.autoops.ai.tool.machine;

import com.autoops.ai.tool.AITool;
import com.autoops.common.error.ApiException;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.service.MachineService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Proposes adding a server to the user's machine list. Validates the address and refuses duplicates server-side and
 * returns a PROPOSE_MACHINE operation. Nothing is saved here: the user reviews it in the machine form, picks a
 * credential and saves; the host key is trusted separately as usual.
 */
@Component
public class ProposeMachineTool implements AITool {
    static final Pattern HOST = Pattern.compile(MachineDtos.HOST_PATTERN);
    private final MachineService machines;

    public ProposeMachineTool(MachineService machines) {
        this.machines = machines;
    }

    public String name() { return "propose_machine"; }

    public ToolRisk risk() { return ToolRisk.PROPOSE; }

    public String description() {
        return "Propose adding a server (machine) to the user's list from a hostname or IP address. Never ask for passwords: "
                + "the user picks a stored credential in the form. Returns a proposal; nothing is saved.";
    }

    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "name", Map.of("type", "string", "description", "Display name; defaults to the hostname"),
                "hostname", Map.of("type", "string", "description", "Hostname or IP address"),
                "sshPort", Map.of("type", "integer", "description", "SSH port, default 22"),
                "operatingSystem", Map.of("type", "string")), "required", List.of("hostname"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        String hostname = Objects.toString(args.get("hostname"), "").strip();
        if (!HOST.matcher(hostname).matches()) {
            throw ApiException.validation("Not a valid hostname or IP address: " + hostname);
        }
        int port = args.get("sshPort") instanceof Number n ? n.intValue() : 22;
        if (port < 1 || port > 65535) {
            throw ApiException.validation("sshPort must be between 1 and 65535");
        }
        machines.list(user).stream()
                .filter(m -> m.hostname().equalsIgnoreCase(hostname) && Objects.equals(m.sshPort(), port)).findFirst()
                .ifPresent(m -> {
                    throw ApiException.conflict("DUPLICATE_MACHINE", "This server is already in the list as " + m.name() + " (id " + m.id() + ")");
                });
        String name = Objects.toString(args.get("name"), "").strip();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", name.isEmpty() ? hostname : (name.length() > 150 ? name.substring(0, 150) : name));
        payload.put("hostname", hostname);
        payload.put("sshPort", port);
        payload.put("operatingSystem", Objects.toString(args.get("operatingSystem"), "").strip());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("operation", Map.of("type", "PROPOSE_MACHINE", "payload", payload));
        out.put("requiresUserConfirmation", true);
        out.put("note", "Nothing was saved yet. Tell the user a card is ready: they click 'Add server', pick a credential and save.");
        return out;
    }
}
