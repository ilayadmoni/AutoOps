package com.autoops.common.security;

/**
 * Principal stored in the security context for authenticated API requests.
 */
public record AuthenticatedUser(Long id, String username, String role) {
    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
