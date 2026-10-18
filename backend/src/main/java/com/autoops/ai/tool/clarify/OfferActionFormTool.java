package com.autoops.ai.tool.clarify;

import com.autoops.ai.tool.AITool;
import com.autoops.ai.validation.ActionFormPayload;
import com.autoops.common.error.ApiException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Offers an existing UI flow for explicit user interaction. This tool never writes or runs anything. */
@Component
public class OfferActionFormTool implements AITool {
    public String name() { return "offer_action_form"; }
    public ToolRisk risk() { return ToolRisk.PROPOSE; }
    public String description() {
        return "Show a chat action card: RUN_WORKFLOW offers a saved workflow picker followed by a server picker and final Run confirmation; "
                + "ADD_CREDENTIAL opens a secure name, username and password form. "
                + "Optional name and username prefill credentials only. Never request or pass passwords or keys. Nothing is saved or executed by this tool.";
    }
    public Map<String, Object> schema() {
        return Map.of("type", "object", "properties", Map.of(
                "action", Map.of("type", "string", "enum", List.of("RUN_WORKFLOW", "ADD_CREDENTIAL")),
                "name", Map.of("type", "string", "maxLength", 150),
                "username", Map.of("type", "string", "maxLength", 150)), "required", List.of("action"), "additionalProperties", false);
    }
    public Object execute(Map<String, Object> args, Long userId) {
        var payload = ActionFormPayload.normalize(args)
                .orElseThrow(() -> ApiException.validation("Choose RUN_WORKFLOW or ADD_CREDENTIAL"));
        return Map.of("operation", Map.of("type", "OFFER_ACTION_FORM", "payload", payload),
                "requiresUserConfirmation", true,
                "note", "The action card is ready. Explain required fields in the user's language. The user completes and confirms it; nothing has run or been saved.");
    }
}
