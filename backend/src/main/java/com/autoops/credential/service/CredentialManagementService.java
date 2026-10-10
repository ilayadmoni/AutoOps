package com.autoops.credential.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.credential.dto.CredentialDtos;
import com.autoops.credential.entity.Credential;
import com.autoops.credential.repository.CredentialRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CredentialManagementService {
    private final CredentialRepository repo;
    private final CredentialCryptoService crypto;
    private final AuditService audit;
    @PersistenceContext
    private EntityManager em;

    public CredentialManagementService(CredentialRepository repo, CredentialCryptoService crypto, AuditService audit) {
        this.repo = repo;
        this.crypto = crypto;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CredentialDtos.CredentialView> list(Long user) {
        return repo.findByDeletedAtIsNullOrderByNameAsc().stream().map(CredentialDtos.CredentialView::from).toList();
    }

    @Transactional(readOnly = true)
    public CredentialDtos.CredentialView get(Long user, Long id) {
        return CredentialDtos.CredentialView.from(requireOwned(user, id));
    }

    @Transactional
    public CredentialDtos.CredentialView create(Long user, CredentialDtos.CreateCredential r) {
        if (r.password().isBlank()) {
            throw ApiException.validation("Password is required", Map.of("password", "Password is required"));
        }
        var c = new Credential();
        c.setName(r.name().trim());
        c.setUsername(r.username().trim());
        setSecret(c, r.password());
        c.setCreatedBy(user);
        c = repo.save(c);
        audit.record(user, "CREDENTIAL_CREATED", "CREDENTIAL", c.getId(), Map.of("name", c.getName(), "username", c.getUsername()));
        return CredentialDtos.CredentialView.from(c);
    }

    @Transactional
    public CredentialDtos.CredentialView update(Long user, Long id, CredentialDtos.UpdateCredential r) {
        var c = requireOwned(user, id);
        c.setName(r.name().trim());
        c.setUsername(r.username().trim());
        boolean rotated = r.password() != null && !r.password().isBlank();
        if (rotated) {
            setSecret(c, r.password());
        }
        c = repo.save(c);
        audit.record(user, "CREDENTIAL_UPDATED", "CREDENTIAL", c.getId(), Map.of("name", c.getName(), "passwordRotated", rotated));
        return CredentialDtos.CredentialView.from(c);
    }

    /**
     * Deletion policy: refuse while a machine prefers this credential or an execution is in progress with it; soft delete
     * (and destroy the secret) when execution history references it; otherwise hard delete.
     */
    @Transactional
    public void delete(Long user, Long id) {
        var c = requireOwned(user, id);
        long machines = count("select count(*) from machines where preferred_credential_id = :id and deleted_at is null", id);
        if (machines > 0) {
            throw ApiException.conflict("CREDENTIAL_IN_USE", "Credential is the preferred credential of " + machines + " machine(s). Change those machines first.");
        }
        long active = count("""
                select count(*) from machine_runs mr join executions e on e.id = mr.execution_id
                where mr.credential_id = :id and e.status in ('PENDING','RUNNING','WAITING_APPROVAL')""", id);
        if (active > 0) {
            throw ApiException.conflict("CREDENTIAL_IN_USE", "Credential is used by an execution in progress");
        }
        em.createNativeQuery("update machines set preferred_credential_id = null where preferred_credential_id = :id and deleted_at is not null")
                .setParameter("id", id).executeUpdate();
        long history = count("select count(*) from machine_runs where credential_id = :id", id);
        if (history > 0) {
            setSecret(c, UUID.randomUUID().toString());
            c.setDeletedAt(Instant.now());
            repo.save(c);
        } else {
            repo.delete(c);
        }
        audit.record(user, "CREDENTIAL_DELETED", "CREDENTIAL", id, Map.of("name", c.getName()));
    }

    /** Returns an owned, non-deleted credential or 404 (never reveals other users' credentials). */
    @Transactional(readOnly = true)
    public Credential requireOwned(Long user, Long id) {
        return repo.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound("Credential"));
    }

    private void setSecret(Credential c, String password) {
        var encrypted = crypto.encrypt(password);
        c.setEncryptedPassword(encrypted.value());
        c.setEncryptionIv(encrypted.iv());
    }

    private long count(String sql, Long id) {
        return ((Number) em.createNativeQuery(sql).setParameter("id", id).getSingleResult()).longValue();
    }
}
