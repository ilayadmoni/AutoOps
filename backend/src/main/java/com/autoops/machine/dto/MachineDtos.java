package com.autoops.machine.dto;

import com.autoops.machine.entity.Machine;
import jakarta.validation.constraints.*;

import java.time.Instant;

public final class MachineDtos {
    /** Hostname (RFC 1123 labels), IPv4, or bracket-less IPv6. */
    public static final String HOST_PATTERN = "^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$|^[0-9A-Fa-f:.]{2,45}$";

    private MachineDtos() {
    }

    public record Upsert(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Pattern(regexp = HOST_PATTERN, message = "Must be a hostname or IP address") String hostname,
            @Min(1) @Max(65535) Integer sshPort,
            @Size(max = 100) String operatingSystem,
            @Size(max = 100) String osVersion,
            Long preferredCredentialId) {
    }

    /** Safe machine representation; never includes credential data. */
    public record Response(Long id, String name, String hostname, Integer sshPort, String operatingSystem, String osVersion,
                           Long preferredCredentialId, String trustStatus, String hostKeyAlgorithm, String sshFingerprint,
                           Instant fingerprintVerifiedAt, String mismatchFingerprint, Instant mismatchDetectedAt,
                           String lastTestStatus, Instant lastTestedAt, Instant createdAt) {
        public static Response from(Machine m) {
            return new Response(m.getId(), m.getName(), m.getHostname(), m.getSshPort(), m.getOperatingSystem(), m.getOsVersion(),
                    m.getPreferredCredentialId(), m.trustStatus(), m.getSshHostKeyAlgorithm(), m.getSshFingerprint(),
                    m.getFingerprintVerifiedAt(), m.getHostKeyMismatchFingerprint(), m.getHostKeyMismatchAt(),
                    m.getLastTestStatus(), m.getLastTestedAt(), m.getCreatedAt());
        }
    }
}
