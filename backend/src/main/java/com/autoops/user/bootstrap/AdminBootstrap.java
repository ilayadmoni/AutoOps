package com.autoops.user.bootstrap;

import com.autoops.audit.service.AuditService;
import com.autoops.user.dto.UserDtos;
import com.autoops.user.entity.User;
import com.autoops.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Creates the initial Admin from AUTOOPS_ADMIN_USERNAME / AUTOOPS_ADMIN_PASSWORD when no Admin exists yet.
 * Idempotent: an existing Admin (or its password) is never modified.
 */
@Component
@Order(10)
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private static final Set<String> WEAK = Set.of("admin", "password", "changeme", "change-me", "admin123", "administrator",
            "replace-me", "autoops", "password123", "change-me-now", "letmein", "qwerty", "123456");

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final String username;
    private final String password;

    public AdminBootstrap(UserRepository users, PasswordEncoder passwords, AuditService audit,
                          @Value("${autoops.bootstrap.admin-username:}") String username,
                          @Value("${autoops.bootstrap.admin-password:}") String password) {
        this.users = users;
        this.passwords = passwords;
        this.audit = audit;
        this.username = username == null ? "" : username.trim();
        this.password = password == null ? "" : password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.countByRole(User.Role.ADMIN) > 0) {
            return;
        }
        if (username.isEmpty() || password.isEmpty()) {
            log.warn("No administrator exists. Set AUTOOPS_ADMIN_USERNAME and AUTOOPS_ADMIN_PASSWORD to bootstrap one.");
            return;
        }
        if (!username.matches(UserDtos.USERNAME_PATTERN)) {
            log.error("AUTOOPS_ADMIN_USERNAME is invalid; administrator was not created.");
            return;
        }
        if (password.length() < UserDtos.PASSWORD_MIN || WEAK.contains(password.toLowerCase(Locale.ROOT))
                || password.toLowerCase(Locale.ROOT).contains("replace") || password.equalsIgnoreCase(username)) {
            log.error("AUTOOPS_ADMIN_PASSWORD is too weak or a placeholder (minimum {} characters); administrator was not created.", UserDtos.PASSWORD_MIN);
            return;
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            log.error("A non-admin user named '{}' already exists; refusing to promote it automatically.", username);
            return;
        }
        var u = new User();
        u.setUsername(username);
        u.setPasswordHash(passwords.encode(password));
        u.setRole(User.Role.ADMIN);
        u.setStatus(User.Status.ACTIVE);
        u = users.save(u);
        audit.record(u.getId(), "ADMIN_BOOTSTRAPPED", "USER", u.getId(), Map.of("username", username));
        log.info("Bootstrapped initial administrator '{}'", username);
    }
}
