package com.autoops.credential.controller;

import com.autoops.common.security.CurrentUser;
import com.autoops.credential.dto.CredentialDtos;
import com.autoops.credential.service.CredentialManagementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/credentials")
public class CredentialController {
    private final CredentialManagementService service;
    private final CurrentUser current;

    public CredentialController(CredentialManagementService service, CurrentUser current) {
        this.service = service;
        this.current = current;
    }

    @GetMapping
    public List<CredentialDtos.CredentialView> list() {
        return service.list(current.id());
    }

    @GetMapping("/{id}")
    public CredentialDtos.CredentialView get(@PathVariable Long id) {
        return service.get(current.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CredentialDtos.CredentialView create(@Valid @RequestBody CredentialDtos.CreateCredential r) {
        return service.create(current.id(), r);
    }

    @PutMapping("/{id}")
    public CredentialDtos.CredentialView update(@PathVariable Long id, @Valid @RequestBody CredentialDtos.UpdateCredential r) {
        return service.update(current.id(), id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(current.id(), id);
    }
}
