package com.autoops.admin.controller;

import com.autoops.admin.service.EnvironmentConfigurationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The /api/admin/** security rule restricts this read-only endpoint to administrators. */
@RestController
@RequestMapping("/api/admin/environment")
public class EnvironmentController {
    private final EnvironmentConfigurationService configuration;

    public EnvironmentController(EnvironmentConfigurationService configuration) {
        this.configuration = configuration;
    }

    @GetMapping
    public ResponseEntity<List<EnvironmentConfigurationService.Setting>> settings() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(configuration.settings());
    }
}
