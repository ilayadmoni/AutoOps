package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.credential.service.CredentialManagementService;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class MachineService {
    private final MachineRepository repo;
    private final CredentialManagementService credentials;
    private final AuditService audit;
    @PersistenceContext
    private EntityManager em;

    public MachineService(MachineRepository repo, CredentialManagementService credentials, AuditService audit) {
        this.repo = repo;
        this.credentials = credentials;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<MachineDtos.Response> list(Long userId) {
        return repo.findByDeletedAtIsNullOrderByNameAsc().stream().map(MachineDtos.Response::from).toList();
    }

    @Transactional(readOnly = true)
    public MachineDtos.Response get(Long userId, Long id) {
        return MachineDtos.Response.from(requireOwned(userId, id));
    }

    @Transactional
    public MachineDtos.Response create(Long userId, MachineDtos.Upsert x) {
        Machine m = new Machine();
        apply(userId, m, x);
        m.setCreatedBy(userId);
        m = repo.save(m);
        audit.record(userId, "MACHINE_CREATED", "MACHINE", m.getId(), Map.of("name", m.getName(), "hostname", m.getHostname(), "port", m.getSshPort()));
        return MachineDtos.Response.from(m);
    }

    @Transactional
    public MachineDtos.Response update(Long userId, Long id, MachineDtos.Upsert x) {
        Machine m = requireOwned(userId, id);
        String oldHost = m.getHostname();
        Integer oldPort = m.getSshPort();
        apply(userId, m, x);
        boolean endpointChanged = !Objects.equals(oldHost, m.getHostname()) || !Objects.equals(oldPort, m.getSshPort());
        if (endpointChanged) {
            // A different endpoint is a different host identity; trust must be re-established explicitly.
            m.clearTrust();
            m.setLastTestStatus(null);
        }
        m = repo.save(m);
        audit.record(userId, "MACHINE_UPDATED", "MACHINE", m.getId(), Map.of("name", m.getName(), "hostname", m.getHostname(), "trustReset", endpointChanged));
        return MachineDtos.Response.from(m);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Machine m = requireOwned(userId, id);
        long active = ((Number) em.createNativeQuery("""
                select count(*) from machine_runs mr join executions e on e.id = mr.execution_id
                where mr.machine_id = :id and e.status in ('PENDING','RUNNING','WAITING_APPROVAL')""")
                .setParameter("id", id).getSingleResult()).longValue();
        if (active > 0) {
            throw ApiException.conflict("MACHINE_IN_USE", "Machine is part of an execution in progress");
        }
        m.setDeletedAt(Instant.now());
        m.setPreferredCredentialId(null);
        repo.save(m);
        audit.record(userId, "MACHINE_DELETED", "MACHINE", id, Map.of("name", m.getName()));
    }

    /** Returns an owned, non-deleted machine or 404. */
    @Transactional(readOnly = true)
    public Machine requireOwned(Long userId, Long id) {
        return repo.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound("Machine"));
    }

    private void apply(Long userId, Machine m, MachineDtos.Upsert x) {
        if (x.preferredCredentialId() != null) {
            credentials.requireOwned(userId, x.preferredCredentialId());
        }
        m.setName(x.name().trim());
        m.setHostname(x.hostname().trim());
        m.setSshPort(x.sshPort() == null ? 22 : x.sshPort());
        m.setOperatingSystem(blankToNull(x.operatingSystem()));
        m.setOsVersion(blankToNull(x.osVersion()));
        m.setPreferredCredentialId(x.preferredCredentialId());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
