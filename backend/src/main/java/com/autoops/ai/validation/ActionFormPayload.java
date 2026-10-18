package com.autoops.ai.validation;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Small allowlist of UI forms. No URLs, commands, secrets or executable input may cross this boundary. */
public final class ActionFormPayload {
    public static final Set<String> ACTIONS = Set.of("RUN_WORKFLOW", "ADD_CREDENTIAL");

    private ActionFormPayload() {}

    public static Optional<Map<String, Object>> normalize(Map<?, ?> input) {
        if (!(input.get("action") instanceof String action) || !ACTIONS.contains(action)) return Optional.empty();
        Map<String, Object> safe = new LinkedHashMap<>();
        safe.put("action", action);
        if (action.equals("ADD_CREDENTIAL")) {
            for (String key : new String[] {"name", "username"}) {
                if (input.get(key) instanceof String value) {
                    if (value.strip().length() > 150) return Optional.empty();
                    safe.put(key, value.strip());
                }
            }
        }
        return Optional.of(safe);
    }
}
