package com.autoops.ai.tool;

import com.autoops.common.error.ApiException;

import java.util.Map;

/** Defensive parsing of model-supplied tool arguments. */
public final class ToolArgs {
    private ToolArgs() {
    }

    public static Long requireLong(Map<String, Object> args, String name) {
        Object v = args.get(name);
        if (v instanceof Number n) {
            return n.longValue();
        }
        if (v instanceof String s && s.matches("\\d{1,18}")) {
            return Long.valueOf(s);
        }
        throw ApiException.validation("Tool argument '" + name + "' must be an integer id");
    }
}
