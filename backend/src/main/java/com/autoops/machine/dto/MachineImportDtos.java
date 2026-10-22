package com.autoops.machine.dto;

import com.autoops.credential.dto.CredentialDtos;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class MachineImportDtos {
    private MachineImportDtos() {}
    public record Row(int index, String name, String hostname, int sshPort, String username,
                      String folderPath, String protocol, String skipReason, List<String> warnings) {
        public Row skipped(String reason) {
            return new Row(index, name, hostname, sshPort, username, folderPath, protocol, reason, warnings);
        }
    }
    public record Preview(List<Row> rows) {}
    public record Selection(@Min(0) int index, @Valid CredentialDtos.CreateCredential credential, @Positive Long existingCredentialId) {
        public Selection(int index, CredentialDtos.CreateCredential credential) { this(index, credential, null); }
        @Override public String toString() { return "Selection[index=" + index + "]"; }
    }
    public record Request(@NotEmpty @Size(max = 2000) List<@NotNull @Valid Selection> selections, @Positive Long baseFolderId) {
        public Request(List<Selection> selections) { this(selections, null); }
    }
    public record Outcome(int index, String name, String status, String reason, Long machineId) {}
    public record Result(long imported, long skipped, long failed, List<Outcome> outcomes) {}
}
