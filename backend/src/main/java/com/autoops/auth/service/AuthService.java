package com.autoops.auth.service;

import com.autoops.audit.service.AuditService;
import com.autoops.auth.dto.AuthDtos;
import com.autoops.auth.entity.RefreshToken;
import com.autoops.auth.repository.RefreshTokenRepository;
import com.autoops.common.error.ApiException;
import com.autoops.user.entity.User;
import com.autoops.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AuthenticationManager auth;
    private final UserRepository users;
    private final JwtService jwt;
    private final RefreshTokenRepository refresh;
    private final AuditService audit;
    private final long refreshMs;

    public AuthService(AuthenticationManager auth, UserRepository users, JwtService jwt, RefreshTokenRepository refresh,
                       AuditService audit, @Value("${autoops.jwt.refresh-expiration}") long refreshMs) {
        this.auth = auth;
        this.users = users;
        this.jwt = jwt;
        this.refresh = refresh;
        this.audit = audit;
        this.refreshMs = refreshMs;
    }

    @Transactional
    public Session login(AuthDtos.LoginRequest r) {
        try {
            var result = auth.authenticate(new UsernamePasswordAuthenticationToken(r.username(), r.password()));
            User u = users.findByUsername(result.getName()).orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
            audit.record(u.getId(), "AUTH_LOGIN_SUCCESS", "USER", u.getId(), Map.of());
            return issue(u);
        } catch (DisabledException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Account is disabled");
        } catch (AuthenticationException e) {
            users.findByUsername(r.username()).ifPresent(u -> audit.recordImmediately(u.getId(), "AUTH_LOGIN_FAILED", "USER", u.getId(), Map.of()));
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid username or password");
        }
    }

    @Transactional
    public Session refresh(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired");
        }
        RefreshToken t = refresh.findByTokenHash(hash(raw))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired"));
        if (t.getRevokedAt() != null) {
            // Reuse of a rotated token suggests theft: revoke the whole token family for this user.
            refresh.revokeAllForUser(t.getUserId(), Instant.now());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired");
        }
        if (t.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired");
        }
        User u = users.findById(t.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Session expired"));
        if (u.getStatus() != User.Status.ACTIVE) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Account is disabled");
        }
        t.setRevokedAt(Instant.now());
        refresh.save(t);
        return issue(u);
    }

    @Transactional
    public void logout(String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        refresh.findByTokenHash(hash(raw)).ifPresent(t -> {
            t.setRevokedAt(Instant.now());
            refresh.save(t);
            audit.record(t.getUserId(), "AUTH_LOGOUT", "USER", t.getUserId(), Map.of());
        });
    }

    @Transactional
    public void revokeAll(Long userId) {
        refresh.revokeAllForUser(userId, Instant.now());
    }

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        refresh.deleteExpiredBefore(Instant.now().minus(Duration.ofDays(1)));
    }

    public long refreshSeconds() {
        return refreshMs / 1000;
    }

    private Session issue(User u) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken t = new RefreshToken();
        t.setUserId(u.getId());
        t.setTokenHash(hash(raw));
        t.setExpiresAt(Instant.now().plusMillis(refreshMs));
        refresh.save(t);
        return new Session(new AuthDtos.AuthResponse(jwt.create(u.getId(), u.getRole().name()), jwt.expiresInSeconds()), raw);
    }

    private static String hash(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public record Session(AuthDtos.AuthResponse response, String refreshToken) {
    }
}
