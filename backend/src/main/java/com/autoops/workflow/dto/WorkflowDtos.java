package com.autoops.workflow.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class WorkflowDtos {
    private WorkflowDtos() {
    }

    /**
     * One typed node. {@code successNext}/{@code failureNext} reference other nodes by key; null ends that path.
     * The first node is the entry point.
     */
    public record Node(
            String key,
            String type,
            String name,
            String description,
            Boolean requiresApproval,
            String successNext,
            String failureNext,
            // COMMAND
            Long commandDefinitionId,
            Map<String, String> parameters,
            Boolean runWithSudo,
            Integer timeoutSeconds,
            // FILE_TRANSFER
            Long storedFileId,
            String destinationPath,
            Boolean overwrite,
            Boolean useSudo,
            // WAIT_UNTIL (reuses commandDefinitionId, parameters, runWithSudo, timeoutSeconds)
            String checkType,
            String expectedOutput,
            Integer expectedExitCode,
            String target,
            Integer intervalSeconds) {

        public String normalizedType() {
            if (type == null) {
                return null;
            }
            return switch (type) {
                case "FILE" -> "FILE_TRANSFER";
                case "WAIT" -> "WAIT_UNTIL";
                default -> type;
            };
        }
    }

    public record Save(@Size(max = 200) String name, @Size(max = 2000) String description, @Valid @Size(max = 100) List<@NotNull Node> nodes, Long version) {
    }

    public record ValidationError(String nodeKey, String field, String message) {
    }

    public record ValidationResult(boolean valid, List<ValidationError> errors) {
    }

    public record WorkflowView(Long id, String name, String description, String status, Long version, Instant createdAt,
                               Instant updatedAt, List<Node> nodes) {
    }

    public record Summary(Long id, String name, String description, String status, int stepCount, Long version, Instant updatedAt) {
    }
}
