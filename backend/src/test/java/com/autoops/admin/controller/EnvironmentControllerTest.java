package com.autoops.admin.controller;

import com.autoops.admin.service.EnvironmentConfigurationService;
import com.autoops.auth.security.JwtAuthenticationFilter;
import com.autoops.common.config.SecurityConfig;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(EnvironmentController.class)
@Import(SecurityConfig.class)
class EnvironmentControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean EnvironmentConfigurationService configuration;
    @MockitoBean JwtAuthenticationFilter jwt;

    @BeforeEach
    void passThroughJwtFilter() throws Exception {
        doAnswer(invocation -> {
            invocation.getArgument(2, FilterChain.class).doFilter(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(jwt).doFilter(any(ServletRequest.class), any(ServletResponse.class), any(FilterChain.class));
    }

    @Test
    void requiresAuthenticationAndAdminRole() throws Exception {
        mvc.perform(get("/api/admin/environment")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/environment").with(user("operator").roles("USER")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(configuration);
    }

    @Test
    void adminCanReadWithoutCachingAndCannotWrite() throws Exception {
        when(configuration.settings()).thenReturn(List.of(
                new EnvironmentConfigurationService.Setting("AI_MODEL", "autoops.ai.model", "model", true, false)));
        mvc.perform(get("/api/admin/environment").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$[0].name").value("AI_MODEL"));
        mvc.perform(post("/api/admin/environment").with(user("admin").roles("ADMIN")))
                .andExpect(status().isMethodNotAllowed());
    }
}
