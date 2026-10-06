package com.autoops.auth.controller;

import com.autoops.auth.dto.AuthDtos;
import com.autoops.auth.service.AuthService;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final String COOKIE = "autoops_refresh";
    /** Custom header required on cookie-authenticated endpoints. Browsers cannot send it cross-origin without a CORS preflight. */
    static final String CLIENT_HEADER = "X-AutoOps-Client";

    private final AuthService service;
    private final CurrentUser current;
    private final boolean cookieSecure;
    private final String sameSite;

    public AuthController(AuthService service, CurrentUser current,
                          @Value("${autoops.auth.cookie-secure:true}") boolean cookieSecure,
                          @Value("${autoops.auth.cookie-same-site:Strict}") String sameSite) {
        this.service = service;
        this.current = current;
        this.cookieSecure = cookieSecure;
        this.sameSite = sameSite;
    }

    @PostMapping("/login")
    public AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest r, HttpServletResponse res) {
        var s = service.login(r);
        cookie(res, s.refreshToken(), service.refreshSeconds());
        return s.response();
    }

    @PostMapping("/refresh")
    public AuthDtos.AuthResponse refresh(@CookieValue(name = COOKIE, required = false) String token,
                                         @RequestHeader(name = CLIENT_HEADER, required = false) String client,
                                         HttpServletResponse res) {
        requireClientHeader(client);
        try {
            var s = service.refresh(token);
            cookie(res, s.refreshToken(), service.refreshSeconds());
            return s.response();
        } catch (ApiException e) {
            cookie(res, "", 0);
            throw e;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@CookieValue(name = COOKIE, required = false) String token,
                       @RequestHeader(name = CLIENT_HEADER, required = false) String client,
                       HttpServletResponse res) {
        requireClientHeader(client);
        service.logout(token);
        cookie(res, "", 0);
    }

    @GetMapping("/me")
    public AuthDtos.MeResponse me() {
        var u = current.get();
        return new AuthDtos.MeResponse(u.id(), u.username(), u.role());
    }

    private static void requireClientHeader(String client) {
        if (client == null || client.isBlank()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CLIENT_HEADER_REQUIRED", "Missing " + CLIENT_HEADER + " header");
        }
    }

    private void cookie(HttpServletResponse res, String value, long maxAgeSeconds) {
        res.addHeader("Set-Cookie", ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(sameSite)
                .path("/api/auth")
                .maxAge(maxAgeSeconds)
                .build().toString());
    }
}
