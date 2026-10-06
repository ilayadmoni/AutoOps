package com.autoops.common.config;

import com.autoops.user.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AuthBeansConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(UserRepository repo) {
        return username -> {
            var u = repo.findByUsername(username)
                    .filter(x -> x.getStatus() != com.autoops.user.entity.User.Status.DELETED)
                    .orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
            return User.withUsername(u.getUsername())
                    .password(u.getPasswordHash())
                    .roles(u.getRole().name())
                    .disabled(u.getStatus() != com.autoops.user.entity.User.Status.ACTIVE)
                    .build();
        };
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception {
        return c.getAuthenticationManager();
    }
}
