package com.autoops.ai.tool;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class AIToolRegistry {
    private final Map<String, AITool> tools;

    public AIToolRegistry(List<AITool> list) {
        Map<String, AITool> m = new HashMap<>();
        list.forEach(t -> m.put(t.name(), t));
        tools = Map.copyOf(m);
    }

    public Collection<AITool> all() {
        return tools.values();
    }

    public AITool require(String name) {
        AITool t = tools.get(name);
        if (t == null) {
            throw new IllegalArgumentException("Unknown AI tool");
        }
        return t;
    }
}
