package com.autoops.common.config;

import com.autoops.auth.security.JwtAuthenticationFilter;
import com.autoops.common.error.ErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain security(HttpSecurity http, JwtAuthenticationFilter jwt, ObjectMapper json) throws Exception {
        return http
                // Access tokens travel in the Authorization header; the refresh cookie is SameSite=Strict, path-scoped and
                // additionally requires a custom request header (see AuthController), so classic CSRF tokens are not used.
                .csrf(c -> c.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> write(res, json, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required"))
                        .accessDeniedHandler((req, res, ex) -> write(res, json, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "You do not have permission to perform this action")))
                .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    private static void write(HttpServletResponse res, ObjectMapper json, int status, String code, String message) throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(res.getOutputStream(), ErrorResponse.of(code, message));
    }
}
