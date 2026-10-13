package com.autoops.ai.service;

import com.autoops.ai.dto.AIOperation;
import com.autoops.ai.validation.QuestionPayload;
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

    /**
     * Some models write the ask_user arguments into their reply instead of calling the tool. A reply that is (or ends
     * with) such a JSON object becomes a real question with clickable options, and the JSON is removed from the text.
     */
    static String recoverTextQuestion(ObjectMapper json, String answer, List<Map<String, Object>> operations) {
        if (answer == null || operations.stream().anyMatch(op -> "ASK_USER".equals(op.get("type")))) {
            return answer;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return answer;
        }
        try {
            Map<String, Object> raw = json.readValue(answer.substring(start, end + 1), new TypeReference<Map<String, Object>>() {});
            var question = QuestionPayload.normalize(raw);
            if (question.isEmpty()) {
                return answer;
            }
            operations.add(Map.of("type", "ASK_USER", "payload", question.get()));
            // Keep any prose before the object; drop a code fence that wrapped it.
            return answer.substring(0, start).replaceAll("(?s)```[a-zA-Z]*\\s*$", "").strip();
        } catch (Exception e) {
            return answer;
        }
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
