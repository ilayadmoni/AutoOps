package com.autoops.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {
    }

    public record LoginRequest(@NotBlank @Size(max = 100) String username, @NotBlank @Size(max = 200) String password) {
    }

    public record AuthResponse(String accessToken, long expiresIn) {
    }

    public record MeResponse(Long id, String username, String role) {
    }
}
