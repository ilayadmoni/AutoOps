package com.autoops.machine.service;

import com.autoops.credential.dto.CredentialDtos;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.machine.dto.MachineImportDtos.Selection;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MachineImportCredentialsTest {
    private final CredentialRepository repo = mock(CredentialRepository.class);
    private final CredentialManagementService credentials = mock(CredentialManagementService.class);
    private final MachineImportCredentials resolver = new MachineImportCredentials(repo, credentials);

    @Test
    void explicitlySelectedDefaultCanServeSessionsWithDifferentUsernames() {
        when(credentials.get(2L, 8L)).thenReturn(new CredentialDtos.CredentialView(
                8L, "Shared login", "admin", "PASSWORD", null, null));

        assertEquals(8L, resolver.resolve(2L, "ops", new Selection(0, null, 8L)));
        assertEquals(8L, resolver.resolve(2L, "root", new Selection(1, null, 8L)));
        verify(credentials, times(2)).get(2L, 8L);
        verifyNoInteractions(repo);
    }

}
