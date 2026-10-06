package com.autoops.auth.controller;
import com.autoops.auth.dto.AuthDtos;import com.autoops.auth.service.AuthService;import jakarta.validation.Valid;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/auth") public class AuthController{private final AuthService service;public AuthController(AuthService s){service=s;}@PostMapping("/login")public AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest r){return service.login(r);}}
