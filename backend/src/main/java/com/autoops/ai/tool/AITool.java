package com.autoops.ai.tool;

import java.util.Map;

/** A controlled, read/validate/propose-only capability exposed to the AI provider. Tools never execute operations. */
public interface AITool {
    String name();

    ToolRisk risk();

    default String description() {
        return "Controlled AutoOps " + risk().name().toLowerCase() + " tool";
    }

    Map<String, Object> schema();

    Object execute(Map<String, Object> args, Long userId);

    enum ToolRisk { READ, PROPOSE, VALIDATE }
}
