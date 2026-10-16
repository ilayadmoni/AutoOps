package com.autoops.machine.service;

import com.autoops.credential.service.CredentialManagementService;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.dto.MachineImportDtos.*;
import com.autoops.machine.repository.MachineRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class MachineImportRowService {
    private final MachineRepository repo;
    private final MachineService machines;
    private final MachineFolderService folders;
    private final CredentialManagementService credentials;
    private final EntityManager em;

    public MachineImportRowService(MachineRepository repo, MachineService machines, MachineFolderService folders,
                                   CredentialManagementService credentials, EntityManager em) {
        this.repo = repo;
        this.machines = machines;
        this.folders = folders;
        this.credentials = credentials;
        this.em = em;
    }

    /** Each row, credential, folder and audit entry commit together; a failed row leaves no partial records. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome create(Long userId, Row row, Selection selection) {
        // Serializes competing imports across application instances until this row commits.
        em.createNativeQuery("select 1 from pg_advisory_xact_lock(728341902)").getSingleResult();
        String endpoint = MobaSessionFields.endpoint(row.hostname(), row.sshPort());
        boolean duplicate = repo.findByDeletedAtIsNullOrderByNameAsc().stream()
                .anyMatch(m -> MobaSessionFields.endpoint(m.getHostname(), m.getSshPort()).equals(endpoint));
        if (duplicate) return new Outcome(row.index(), row.name(), "SKIPPED", "DUPLICATE", null);
        Long folderId = folders.ensurePath(row.folderPath());
        Long credentialId = selection.credential() == null ? null : credentials.create(userId, selection.credential()).id();
        var machine = machines.create(userId, new MachineDtos.Upsert(row.name(), row.hostname(), row.sshPort(),
                null, null, credentialId, folderId));
        return new Outcome(row.index(), row.name(), "IMPORTED", null, machine.id());
    }
}
