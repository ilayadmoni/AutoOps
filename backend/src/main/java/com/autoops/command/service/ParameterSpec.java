package com.autoops.command.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Declares one {{placeholder}} of a command template. Types: STRING, INTEGER, PATH, SERVICE, PACKAGE, HOSTNAME, ENUM.
 */
public record ParameterSpec(
        @NotBlank @Pattern(regexp = "^[A-Za-z_][A-Za-z0-9_]{0,63}$") String name,
        @Size(max = 120) String label,
        @Pattern(regexp = "^(STRING|INTEGER|PATH|SERVICE|PACKAGE|HOSTNAME|ENUM)$") String type,
        Boolean required,
        @Size(max = 500) String description,
        List<@Size(max = 200) String> allowedValues,
        @Size(max = 256) String defaultValue) {

    public String typeOrDefault() {
        return type == null || type.isBlank() ? "STRING" : type;
    }

    public boolean isRequired() {
        return required == null || required;
    }

    public ParameterSpec normalized() {
        return new ParameterSpec(name, label == null || label.isBlank() ? name : label, typeOrDefault(), isRequired(),
                description, allowedValues == null ? List.of() : List.copyOf(allowedValues), defaultValue);
    }
}
