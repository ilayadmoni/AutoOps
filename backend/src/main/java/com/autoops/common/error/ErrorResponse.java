package com.autoops.common.error;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(String code, String message, Map<String, String> fieldErrors, Instant timestamp) {
    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, Map.of(), Instant.now());
    }

    public static ErrorResponse of(String code, String message, Map<String, String> fieldErrors) {
        return new ErrorResponse(code, message, fieldErrors, Instant.now());
    }
}
