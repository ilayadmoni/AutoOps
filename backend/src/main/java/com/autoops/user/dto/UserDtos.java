package com.autoops.user.dto;

import com.autoops.user.entity.User;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class UserDtos {
    public static final String USERNAME_PATTERN = "^[A-Za-z0-9._-]{3,64}$";
    public static final int PASSWORD_MIN = 10;
    public static final int PASSWORD_MAX = 128;

    private UserDtos() {
    }

    /** Safe user representation. Never includes password material. */
    public record UserView(Long id, String username, String role, String status, Instant createdAt) {
        public static UserView from(User u) {
            return new UserView(u.getId(), u.getUsername(), u.getRole().name(), u.getStatus().name(), u.getCreatedAt());
        }
    }

    public record CreateUser(
            @NotBlank @Pattern(regexp = USERNAME_PATTERN, message = "3-64 characters: letters, digits, dot, underscore or dash") String username,
            @NotBlank @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Password must be 10-128 characters") String password,
            @NotNull User.Role role) {
    }

    public record UpdateStatus(@NotNull User.Status status) {
    }

    public record UpdateRole(@NotNull User.Role role) {
    }

    public record ResetPassword(
            @NotBlank @Size(min = PASSWORD_MIN, max = PASSWORD_MAX, message = "Password must be 10-128 characters") String password) {
    }
}
