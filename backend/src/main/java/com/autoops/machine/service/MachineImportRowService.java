package com.autoops.machine.service;

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
    private final MachineImportCredentials credentials;
    private final EntityManager em;

    public MachineImportRowService(MachineRepository repo, MachineService machines, MachineFolderService folders,
                                   MachineImportCredentials credentials, EntityManager em) {
        this.repo = repo;
        this.machines = machines;
        this.folders = folders;
        this.credentials = credentials;
        this.em = em;
    }

    /** Each row, credential, folder and audit entry commit together; a failed row leaves no partial records. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome create(Long userId, Row row, Selection selection) {
        return create(userId, row, selection, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome create(Long userId, Row row, Selection selection, Long baseFolderId) {
        // Serializes competing imports across application instances until this row commits.
        em.createNativeQuery(MachineFolderLock.SQL).getSingleResult();
        String endpoint = MobaSessionFields.endpoint(row.hostname(), row.sshPort());
        boolean duplicate = repo.findByDeletedAtIsNullOrderByNameAsc().stream()
                .anyMatch(m -> MobaSessionFields.endpoint(m.getHostname(), m.getSshPort()).equals(endpoint));
        if (duplicate) return new Outcome(row.index(), row.name(), "SKIPPED", "DUPLICATE", null);
        Long credentialId = credentials.resolve(userId, row.username(), selection);
        Long folderId = baseFolderId == null ? folders.ensurePath(row.folderPath()) : folders.ensureRelativePath(row.folderPath(), baseFolderId);
        var machine = machines.create(userId, new MachineDtos.Upsert(row.name(), row.hostname(), row.sshPort(),
                null, null, credentialId, folderId));
        return new Outcome(row.index(), row.name(), "IMPORTED", null, machine.id());
    }
}
