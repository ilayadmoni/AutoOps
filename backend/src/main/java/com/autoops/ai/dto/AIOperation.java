package com.autoops.ai.dto;

import java.util.List;
import java.util.Map;

/** A validated, user-reviewable proposal. Applying it always goes through the normal UI and backend paths. */
public record AIOperation(String type, Map<String, Object> payload, List<MissingField> missingFields) {
    public record MissingField(String nodeKey, String field, String message) {
    }
}
