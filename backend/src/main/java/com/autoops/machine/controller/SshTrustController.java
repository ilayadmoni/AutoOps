package com.autoops.machine.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.service.MachineTestService;
import com.autoops.machine.service.SshHostTrustService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/machines/{machineId}")
public class SshTrustController {
    private final SshHostTrustService trust;
    private final MachineTestService tests;
    private final CurrentUser current;

    public SshTrustController(SshHostTrustService trust, MachineTestService tests, CurrentUser current) {
        this.trust = trust;
        this.tests = tests;
        this.current = current;
    }

    public record Confirm(@NotBlank String expectedFingerprint) {
    }

    public record TestRequest(Long credentialId, Boolean checkSudo) {
    }

    @PostMapping("/ssh-trust/discover")
    public SshHostTrustService.Discovery discover(@PathVariable Long machineId) {
        return trust.discover(current.id(), machineId);
    }

    @PostMapping("/ssh-trust/confirm")
    public MachineDtos.Response confirm(@PathVariable Long machineId, @RequestBody Confirm r) {
        return trust.confirm(current.id(), machineId, r.expectedFingerprint());
    }

    @DeleteMapping("/ssh-trust")
    public MachineDtos.Response revoke(@PathVariable Long machineId) {
        return trust.revoke(current.id(), machineId);
    }

    @PostMapping("/test")
    public MachineTestService.TestResult test(@PathVariable Long machineId, @RequestBody(required = false) TestRequest r) {
        return tests.test(current.id(), machineId, r == null ? null : r.credentialId(), r == null || r.checkSudo() == null || r.checkSudo());
    }
}
