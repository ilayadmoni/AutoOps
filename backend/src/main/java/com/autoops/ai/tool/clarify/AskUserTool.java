package com.autoops.ai.tool.clarify;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.validation.QuestionPayload;
import com.autoops.common.error.ApiException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Asks the user one clarifying question with clickable options when their intent is unclear. Returns an ASK_USER
 * operation; the chosen option comes back as the user's next message. The assistant turn ends after this tool.
 */
@Component
public class AskUserTool implements AITool {
    public static final String NAME = "ask_user";

    public String name() { return NAME; }

    public ToolRisk risk() { return ToolRisk.PROPOSE; }

    public String description() {
        return "Ask the user one clarifying question with 2-5 short options when you are not confident what they want "
                + "(for example: build a workflow, or just answer). The user clicks an option or writes their own answer; "
                + "it arrives as their next message. Call no other tool in the same turn.";
    }

    public Map<String, Object> schema() {
        Map<String, Object> option = Map.of("type", "object", "properties", Map.of(
                "label", Map.of("type", "string", "description", "Short answer the user clicks, in the user's language"),
                "description", Map.of("type", "string", "description", "Optional one-line explanation")), "required", List.of("label"));
        return Map.of("type", "object", "properties", Map.of(
                "question", Map.of("type", "string", "description", "One short question in the user's language"),
                "options", Map.of("type", "array", "items", option, "minItems", QuestionPayload.MIN_OPTIONS, "maxItems", QuestionPayload.MAX_OPTIONS),
                "allowOther", Map.of("type", "boolean", "description", "Let the user type a different answer; default true")),
                "required", List.of("question", "options"));
    }

    public Object execute(Map<String, Object> args, Long user) {
        Map<String, Object> payload = QuestionPayload.normalize(args).orElseThrow(() -> ApiException.validation(
                "ask_user needs a non-blank question and " + QuestionPayload.MIN_OPTIONS + "-" + QuestionPayload.MAX_OPTIONS + " distinct option labels"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("operation", Map.of("type", "ASK_USER", "payload", payload));
        out.put("note", "The question is shown with clickable options. Stop here and wait for the user's answer.");
        return out;
    }
}
