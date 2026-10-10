package com.autoops.ai.service;

import com.autoops.ai.dto.AIOperation;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/** Formatting and bounded serialization shared by the assistant loop. */
final class AIChatSupport {
    private AIChatSupport() {}

    static String withQuestion(String answer, List<AIOperation> operations) {
        for (AIOperation op : operations) {
            if ("ASK_USER".equals(op.type()) && op.payload().get("question") instanceof String question) {
                if (answer == null || answer.isBlank()) answer = question;
                else if (!answer.contains(question)) answer = answer.strip() + "\n\n" + question;
            }
        }
        return answer;
    }

    static Map<String, Object> parseArgs(ObjectMapper json, String raw) {
        try {
            Map<String, Object> args = json.readValue(raw == null || raw.isBlank() ? "{}" : raw,
                    new TypeReference<Map<String, Object>>() {});
            return args == null ? Map.of() : args;
        } catch (Exception e) {
            return Map.of("__invalid", true);
        }
    }

    static String bounded(ObjectMapper json, Object result) {
        String text;
        try { text = json.writeValueAsString(result); }
        catch (Exception e) { text = "{\"error\":\"unserializable result\"}"; }
        return text.length() > 12000 ? text.substring(0, 12000) + "…(truncated)" : text;
    }

    static String load(String path) {
        try {
            return new String(new ClassPathResource(path).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Missing prompt " + path, e);
        }
    }
}
