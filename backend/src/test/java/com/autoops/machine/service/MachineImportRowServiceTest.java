package com.autoops.machine.service;

import com.autoops.credential.dto.CredentialDtos;
import com.autoops.credential.repository.CredentialRepository;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.dto.MachineImportDtos.*;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import jakarta.persistence.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MachineImportRowServiceTest {
    private final MachineRepository repo = mock(MachineRepository.class);
    private final MachineService machines = mock(MachineService.class);
    private final MachineFolderService folders = mock(MachineFolderService.class);
    private final CredentialManagementService credentials = mock(CredentialManagementService.class);
    private final CredentialRepository credentialRepo = mock(CredentialRepository.class);
    private final MachineImportCredentials importCredentials = new MachineImportCredentials(credentialRepo, credentials);
    private final EntityManager em = mock(EntityManager.class);
    private final MachineImportRowService service = new MachineImportRowService(repo, machines, folders, importCredentials, em);
    private final Row row = new Row(0, "VM", "vm.example", 22, "ops", "Lab/Apps", "SSH", null, List.of());

    private void setup() {
        when(em.createNativeQuery(anyString())).thenReturn(mock(Query.class));
        when(repo.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of());
        when(credentialRepo.findTop2ByUsernameAndDeletedAtIsNullOrderByIdAsc("ops")).thenReturn(List.of());
        when(folders.ensurePath("Lab/Apps")).thenReturn(8L);
        when(machines.create(eq(1L), any())).thenAnswer(call -> {
            Machine m = new Machine(); m.setName("VM"); m.setHostname("vm.example");
            return MachineDtos.Response.from(m);
        });
    }

    @Test void rechecksDuplicatesBeforeCreatingCredentialsOrFolders() {
        setup();
        Machine existing = new Machine(); existing.setHostname("VM.EXAMPLE");
        when(repo.findByDeletedAtIsNullOrderByNameAsc()).thenReturn(List.of(existing));
        var result = service.create(1L, row, new Selection(0, new CredentialDtos.CreateCredential("cred", "ops", "secret")));
        assertEquals("DUPLICATE", result.reason());
        verifyNoInteractions(folders, credentials, machines);
    }

    @Test void importsWithoutCredentialsAndKeepsNewMachinesUntrusted() {
        setup();
        assertEquals("IMPORTED", service.create(1L, row, new Selection(0, null)).status());
        verify(machines).create(eq(1L), argThat(x -> x.preferredCredentialId() == null && x.folderId().equals(8L)));
        verifyNoInteractions(credentials);
        assertEquals("UNTRUSTED", new Machine().trustStatus());
    }

    @Test void createsExplicitCredentialWithoutMatchingExistingCredentials() {
        setup();
        var credential = new CredentialDtos.CreateCredential("Moba: VM", "ops", "secret");
        when(credentials.create(1L, credential)).thenReturn(new CredentialDtos.CredentialView(31L, "Moba: VM", "ops", "PASSWORD", null, null));
        service.create(1L, row, new Selection(0, credential));
        verify(credentials).create(1L, credential);
        verify(credentials, never()).list(anyLong());
        verify(machines).create(eq(1L), argThat(x -> x.preferredCredentialId().equals(31L)));
    }
}
