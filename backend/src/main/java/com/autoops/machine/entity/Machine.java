package com.autoops.machine.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "machines")
public class Machine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String hostname;
    @Column(name = "ssh_port", nullable = false)
    private Integer sshPort = 22;
    @Column(name = "operating_system")
    private String operatingSystem;
    @Column(name = "os_version")
    private String osVersion;
    @Column(name = "preferred_credential_id")
    private Long preferredCredentialId;
    @Column(name = "ssh_host_key", columnDefinition = "text")
    private String sshHostKey;
    @Column(name = "ssh_host_key_algorithm")
    private String sshHostKeyAlgorithm;
    @Column(name = "ssh_fingerprint")
    private String sshFingerprint;
    @Column(name = "fingerprint_verified_at")
    private Instant fingerprintVerifiedAt;
    @Column(name = "host_key_mismatch_at")
    private Instant hostKeyMismatchAt;
    @Column(name = "host_key_mismatch_fingerprint")
    private String hostKeyMismatchFingerprint;
    @Column(name = "last_test_status")
    private String lastTestStatus;
    @Column(name = "last_tested_at")
    private Instant lastTestedAt;
    @Column(name = "created_by")
    private Long createdBy;
    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();
    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public boolean isTrusted() {
        return sshHostKey != null && sshFingerprint != null && sshHostKeyAlgorithm != null;
    }

    /** UNTRUSTED, TRUSTED, or KEY_CHANGED when a different key was presented after the key was trusted. */
    public String trustStatus() {
        if (!isTrusted()) {
            return "UNTRUSTED";
        }
        if (hostKeyMismatchAt != null && (fingerprintVerifiedAt == null || hostKeyMismatchAt.isAfter(fingerprintVerifiedAt))) {
            return "KEY_CHANGED";
        }
        return "TRUSTED";
    }

    public void trust(String algorithm, String base64Key, String fingerprint) {
        sshHostKeyAlgorithm = algorithm;
        sshHostKey = base64Key;
        sshFingerprint = fingerprint;
        fingerprintVerifiedAt = Instant.now();
        hostKeyMismatchAt = null;
        hostKeyMismatchFingerprint = null;
    }

    public void clearTrust() {
        sshHostKeyAlgorithm = null;
        sshHostKey = null;
        sshFingerprint = null;
        fingerprintVerifiedAt = null;
        hostKeyMismatchAt = null;
        hostKeyMismatchFingerprint = null;
    }

    public void recordMismatch(String presentedFingerprint) {
        hostKeyMismatchAt = Instant.now();
        hostKeyMismatchFingerprint = presentedFingerprint;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { name = v; }
    public String getHostname() { return hostname; }
    public void setHostname(String v) { hostname = v; }
    public Integer getSshPort() { return sshPort; }
    public void setSshPort(Integer v) { sshPort = v; }
    public String getOperatingSystem() { return operatingSystem; }
    public void setOperatingSystem(String v) { operatingSystem = v; }
    public String getOsVersion() { return osVersion; }
    public void setOsVersion(String v) { osVersion = v; }
    public Long getPreferredCredentialId() { return preferredCredentialId; }
    public void setPreferredCredentialId(Long v) { preferredCredentialId = v; }
    public String getSshHostKey() { return sshHostKey; }
    public String getSshHostKeyAlgorithm() { return sshHostKeyAlgorithm; }
    public String getSshFingerprint() { return sshFingerprint; }
    public Instant getFingerprintVerifiedAt() { return fingerprintVerifiedAt; }
    public Instant getHostKeyMismatchAt() { return hostKeyMismatchAt; }
    public String getHostKeyMismatchFingerprint() { return hostKeyMismatchFingerprint; }
    public String getLastTestStatus() { return lastTestStatus; }
    public void setLastTestStatus(String v) { lastTestStatus = v; }
    public Instant getLastTestedAt() { return lastTestedAt; }
    public void setLastTestedAt(Instant v) { lastTestedAt = v; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long v) { createdBy = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant v) { deletedAt = v; }
}
