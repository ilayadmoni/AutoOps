package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.infrastructure.remote.RemoteClient;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.SshHostKey;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Explicit SSH host trust. The browser is never authoritative for the key: the backend discovers it, the user confirms
 * the fingerprint, and the backend re-discovers the key and stores it only if it matches what the user confirmed.
 */
@Service
public class SshHostTrustService {
    private final MachineRepository machines;
    private final MachineService machineService;
    private final RemoteClient remote;
    private final AuditService audit;

    public SshHostTrustService(MachineRepository machines, MachineService machineService, RemoteClient remote, AuditService audit) {
        this.machines = machines;
        this.machineService = machineService;
        this.remote = remote;
        this.audit = audit;
    }

    public record Discovery(Long machineId, String hostname, int port, String algorithm, String fingerprint,
                            String currentTrustStatus, String trustedFingerprint, boolean matchesTrusted) {
    }

    public Discovery discover(Long userId, Long machineId) {
        Machine m = machineService.requireOwned(userId, machineId);
        SshHostKey key = probe(m);
        boolean matches = m.isTrusted() && SshHostKey.sameFingerprint(key.fingerprint(), m.getSshFingerprint());
        return new Discovery(m.getId(), m.getHostname(), m.getSshPort(), key.algorithm(), key.fingerprint(),
                m.trustStatus(), m.getSshFingerprint(), matches);
    }

    @Transactional
    public MachineDtos.Response confirm(Long userId, Long machineId, String expectedFingerprint) {
        if (expectedFingerprint == null || expectedFingerprint.isBlank()) {
            throw ApiException.validation("Expected fingerprint is required", Map.of("expectedFingerprint", "Required"));
        }
        Machine m = machineService.requireOwned(userId, machineId);
        // Fresh discovery: the key that is stored is the one the server presents now, not anything the client sent.
        SshHostKey key = probe(m);
        if (!SshHostKey.sameFingerprint(key.fingerprint(), expectedFingerprint)) {
            audit.recordImmediately(userId, "SSH_TRUST_CONFIRM_REJECTED", "MACHINE", m.getId(),
                    Map.of("expectedFingerprint", expectedFingerprint, "presentedFingerprint", key.fingerprint()));
            throw new ApiException(HttpStatus.CONFLICT, "SSH_FINGERPRINT_CHANGED",
                    "The server's host key no longer matches the fingerprint you confirmed. Discover again and review it.");
        }
        String previous = m.getSshFingerprint();
        m.trust(key.algorithm(), key.base64Key(), key.fingerprint());
        m = machines.save(m);
        audit.record(userId, previous == null ? "SSH_TRUST_CONFIRMED" : "SSH_TRUST_REPLACED", "MACHINE", m.getId(),
                Map.of("fingerprint", key.fingerprint(), "algorithm", key.algorithm(), "previousFingerprint", String.valueOf(previous)));
        return MachineDtos.Response.from(m);
    }

    @Transactional
    public MachineDtos.Response revoke(Long userId, Long machineId) {
        Machine m = machineService.requireOwned(userId, machineId);
        m.clearTrust();
        m = machines.save(m);
        audit.record(userId, "SSH_TRUST_REVOKED", "MACHINE", m.getId(), Map.of());
        return MachineDtos.Response.from(m);
    }

    private SshHostKey probe(Machine m) {
        try {
            return remote.discoverHostKey(m.getHostname(), m.getSshPort());
        } catch (RemoteException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "SSH_" + e.kind().name(), e.getMessage());
        }
    }
}
