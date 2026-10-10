package com.autoops.ai.validation;

import java.util.*;

/**
 * Normalizes a clarifying question (ASK_USER) from model-supplied data: a question with 2–5 distinct short options and
 * an optional free-text answer. Shared by the ask_user tool and the operation validator so both apply the same rules.
 */
public final class QuestionPayload {
    public static final int MIN_OPTIONS = 2;
    public static final int MAX_OPTIONS = 5;
    static final int MAX_QUESTION = 300;
    static final int MAX_LABEL = 80;
    static final int MAX_DESCRIPTION = 160;

    private QuestionPayload() {
    }

    /** The normalized payload, or empty when it is not a usable question. */
    public static Optional<Map<String, Object>> normalize(Map<?, ?> raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String question = clip(raw.get("question"), MAX_QUESTION);
        if (question.isEmpty() || !(raw.get("options") instanceof List<?> list)) {
            return Optional.empty();
        }
        List<Map<String, Object>> options = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object o : list) {
            Object label = o instanceof Map<?, ?> m ? m.get("label") : o;
            String text = clip(label, MAX_LABEL);
            if (text.isEmpty() || !seen.add(text.toLowerCase(Locale.ROOT))) {
                continue;
            }
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("label", text);
            String description = o instanceof Map<?, ?> m ? clip(m.get("description"), MAX_DESCRIPTION) : "";
            if (!description.isEmpty()) {
                option.put("description", description);
            }
            options.add(option);
            if (options.size() == MAX_OPTIONS) {
                break;
            }
        }
        if (options.size() < MIN_OPTIONS) {
            return Optional.empty();
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("question", question);
        payload.put("options", options);
        payload.put("allowOther", !Boolean.FALSE.equals(raw.get("allowOther")));
        return Optional.of(payload);
    }

    private static String clip(Object value, int max) {
        String s = value instanceof String str ? str.strip() : "";
        return s.length() > max ? s.substring(0, max).strip() + "…" : s;
    }
}
