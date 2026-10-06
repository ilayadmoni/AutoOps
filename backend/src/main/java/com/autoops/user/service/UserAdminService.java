package com.autoops.user.service;

import com.autoops.audit.service.AuditService;
import com.autoops.auth.service.AuthService;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.CurrentUser;
import com.autoops.user.dto.UserDtos;
import com.autoops.user.entity.User;
import com.autoops.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class UserAdminService {
    private final UserRepository repo;
    private final PasswordEncoder passwords;
    private final CurrentUser current;
    private final AuthService auth;
    private final AuditService audit;

    public UserAdminService(UserRepository repo, PasswordEncoder passwords, CurrentUser current, AuthService auth, AuditService audit) {
        this.repo = repo;
        this.passwords = passwords;
        this.current = current;
        this.auth = auth;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<UserDtos.UserView> list() {
        return repo.findByStatusNotOrderByUsernameAsc(User.Status.DELETED).stream().map(UserDtos.UserView::from).toList();
    }

    @Transactional
    public UserDtos.UserView create(UserDtos.CreateUser r) {
        String username = r.username().trim();
        if (repo.existsByUsernameIgnoreCase(username)) {
            throw ApiException.conflict("USERNAME_TAKEN", "Username already exists");
        }
        var u = new User();
        u.setUsername(username);
        u.setPasswordHash(passwords.encode(r.password()));
        u.setRole(r.role());
        u.setStatus(User.Status.ACTIVE);
        u = repo.save(u);
        audit.record(current.id(), "ADMIN_USER_CREATED", "USER", u.getId(), Map.of("username", username, "role", r.role().name()));
        return UserDtos.UserView.from(u);
    }

    @Transactional
    public UserDtos.UserView status(Long id, User.Status status) {
        var u = load(id);
        if (status == User.Status.DELETED) {
            throw ApiException.validation("Use the delete endpoint to delete users");
        }
        guardLastAdmin(u, status, u.getRole());
        u.setStatus(status);
        if (status != User.Status.ACTIVE) {
            auth.revokeAll(u.getId());
        }
        audit.record(current.id(), "ADMIN_USER_STATUS_CHANGED", "USER", u.getId(), Map.of("status", status.name()));
        return UserDtos.UserView.from(repo.save(u));
    }

    @Transactional
    public UserDtos.UserView role(Long id, User.Role role) {
        var u = load(id);
        guardLastAdmin(u, u.getStatus(), role);
        u.setRole(role);
        audit.record(current.id(), "ADMIN_USER_ROLE_CHANGED", "USER", u.getId(), Map.of("role", role.name()));
        return UserDtos.UserView.from(repo.save(u));
    }

    @Transactional
    public void delete(Long id) {
        var u = load(id);
        if (u.getId().equals(current.id())) {
            throw ApiException.conflict("CANNOT_DELETE_SELF", "You cannot delete your own account");
        }
        guardLastAdmin(u, User.Status.DELETED, u.getRole());
        u.setStatus(User.Status.DELETED);
        u.setDeletedAt(Instant.now());
        repo.save(u);
        auth.revokeAll(u.getId());
        audit.record(current.id(), "ADMIN_USER_DELETED", "USER", u.getId(), Map.of("username", u.getUsername()));
    }

    @Transactional
    public void resetPassword(Long id, String password) {
        var u = load(id);
        u.setPasswordHash(passwords.encode(password));
        repo.save(u);
        auth.revokeAll(u.getId());
        audit.record(current.id(), "ADMIN_USER_PASSWORD_RESET", "USER", u.getId(), Map.of());
    }

    private User load(Long id) {
        return repo.findById(id).filter(u -> u.getStatus() != User.Status.DELETED).orElseThrow(() -> ApiException.notFound("User"));
    }

    /** Applies to any active Admin, not only the caller: the system must always keep at least one active Admin. */
    private void guardLastAdmin(User target, User.Status newStatus, User.Role newRole) {
        boolean isActiveAdmin = target.getRole() == User.Role.ADMIN && target.getStatus() == User.Status.ACTIVE;
        boolean remainsActiveAdmin = newRole == User.Role.ADMIN && newStatus == User.Status.ACTIVE;
        if (isActiveAdmin && !remainsActiveAdmin && repo.countByRoleAndStatus(User.Role.ADMIN, User.Status.ACTIVE) <= 1) {
            throw ApiException.conflict("LAST_ACTIVE_ADMIN", "At least one active administrator must remain");
        }
    }
}
