package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.service.CredentialCryptoService;
import com.autoops.infrastructure.remote.RemoteClient;
import com.autoops.infrastructure.remote.RemoteException;
import com.autoops.infrastructure.remote.RemoteSession;
import com.autoops.infrastructure.remote.RemoteTarget;
import com.autoops.infrastructure.remote.SshHostKey;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;

/**
 * The single entry point for authenticated SSH/SFTP access to a machine. Every session is verified against the key
 * persisted for that machine; untrusted machines are refused and mismatches are recorded (never auto-trusted).
 */
@Service
public class MachineConnectionService {
    private final RemoteClient remote;
    private final CredentialCryptoService crypto;
    private final MachineRepository machines;
    private final AuditService audit;
    private final TransactionTemplate tx;

    public MachineConnectionService(RemoteClient remote, CredentialCryptoService crypto, MachineRepository machines,
                                    AuditService audit, PlatformTransactionManager txManager) {
        this.remote = remote;
        this.crypto = crypto;
        this.machines = machines;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public RemoteSession connect(Machine machine, Credential credential) {
        if (!machine.isTrusted()) {
            throw new RemoteException(RemoteException.Kind.UNTRUSTED_HOST, "SSH host key is not trusted for this machine. Discover and confirm the fingerprint first.");
        }
        if ("KEY_CHANGED".equals(machine.trustStatus())) {
            throw new RemoteException(RemoteException.Kind.HOST_KEY_MISMATCH,
                    "SSH host key changed since it was trusted. Review and re-confirm the fingerprint before connecting.",
                    machine.getHostKeyMismatchFingerprint());
        }
        SshHostKey trusted = new SshHostKey(machine.getSshHostKeyAlgorithm(), machine.getSshHostKey(), machine.getSshFingerprint());
        String password = crypto.decrypt(credential.getEncryptedPassword(), credential.getEncryptionIv());
        try {
            return remote.open(new RemoteTarget(machine.getHostname(), machine.getSshPort(), credential.getUsername(), password, trusted));
        } catch (RemoteException e) {
            if (e.kind() == RemoteException.Kind.HOST_KEY_MISMATCH) {
                recordMismatch(machine.getId(), machine.getCreatedBy(), e.presentedFingerprint());
            }
            throw e;
        }
    }

    /** Returns the decrypted password for sudo-on-stdin; never logged or persisted. */
    public String sudoPassword(Credential credential) {
        return crypto.decrypt(credential.getEncryptedPassword(), credential.getEncryptionIv());
    }

    private void recordMismatch(Long machineId, Long ownerId, String presented) {
        tx.executeWithoutResult(s -> machines.findById(machineId).ifPresent(m -> {
            m.recordMismatch(presented);
            machines.save(m);
        }));
        audit.record(ownerId, "SSH_HOST_KEY_MISMATCH", "MACHINE", machineId, Map.of("presentedFingerprint", String.valueOf(presented)));
    }
}
