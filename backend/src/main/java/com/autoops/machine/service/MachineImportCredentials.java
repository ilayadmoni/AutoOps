package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.machine.dto.MachineImportDtos.Selection;
import org.springframework.stereotype.Service;

/** Matches active shared credentials using exact, case-sensitive SSH usernames. Never reads password content. */
@Service
public class MachineImportCredentials {
    private final CredentialRepository repo;
    private final CredentialManagementService credentials;
    public MachineImportCredentials(CredentialRepository repo, CredentialManagementService credentials) {
        this.repo = repo; this.credentials = credentials;
    }
    public Long resolve(Long userId, String username, Selection selection) {
        if (selection.credential() != null && selection.existingCredentialId() != null) {
            throw ApiException.validation("Choose an existing credential or create a new one, not both");
        }
        if (selection.credential() != null) return credentials.create(userId, selection.credential()).id();
        if (selection.existingCredentialId() != null) {
            var existing = credentials.get(userId, selection.existingCredentialId());
            return existing.id();
        }
        if (username == null || username.isBlank()) return null;
        var matches = repo.findTop2ByUsernameAndDeletedAtIsNullOrderByIdAsc(username);
        if (matches.size() > 1) throw ApiException.badRequest("CREDENTIAL_AMBIGUOUS", "Multiple credentials match this username; choose one before importing");
        return matches.isEmpty() ? null : matches.getFirst().getId();
    }
}
