package com.autoops.common.config;
import org.springframework.context.annotation.Bean;import org.springframework.context.annotation.Configuration;import org.springframework.security.config.annotation.web.builders.HttpSecurity;import org.springframework.security.web.SecurityFilterChain;
@Configuration public class SecurityConfig{@Bean SecurityFilterChain security(HttpSecurity http)throws Exception{return http.csrf(c->c.disable()).authorizeHttpRequests(a->a.requestMatchers("/actuator/health").permitAll().anyRequest().permitAll()).build();}}
