package com.autoops.credential.dto;

import com.autoops.credential.entity.Credential;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class CredentialDtos {
    private CredentialDtos() {
    }

    /** Never contains the password, ciphertext or IV. */
    public record CredentialView(Long id, String name, String username, String authType, Instant createdAt, Instant updatedAt) {
        public static CredentialView from(Credential c) {
            return new CredentialView(c.getId(), c.getName(), c.getUsername(), c.getAuthType(), c.getCreatedAt(), c.getUpdatedAt());
        }
    }

    public record CreateCredential(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Size(max = 150) String username,
            @NotBlank @Size(max = 512) String password) {
    }

    /** Password is optional: when present and non-blank it rotates the stored secret. */
    public record UpdateCredential(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Size(max = 150) String username,
            @Size(max = 512) String password) {
    }
}
