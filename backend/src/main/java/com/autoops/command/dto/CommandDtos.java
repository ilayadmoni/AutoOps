package com.autoops.command.dto;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.service.ParameterSpec;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class CommandDtos {
    private CommandDtos() {
    }

    public record Create(
            @NotBlank @Size(max = 200) String name,
            @Size(max = 2000) String description,
            @Size(max = 80) String category,
            @Size(max = 80) String action,
            @Size(max = 80) String resourceType,
            @NotBlank @Size(max = 4000) String commandTemplate,
            @Valid List<ParameterSpec> parameters) {
    }

    public record Preview(Map<String, String> parameters, Boolean runWithSudo) {
    }

    public record PreviewResult(Long commandId, String resolvedCommand, String executedForm, String riskLevel,
                                String effectiveRiskLevel, boolean requiresHighRiskAcknowledgement) {
    }

    public record Reject(@Size(max = 1000) String reason) {
    }

    public record CommandView(Long id, String name, String description, String category, String action, String resourceType,
                              String commandTemplate, List<ParameterSpec> parameters, String riskLevel, boolean requiresApproval,
                              String status, String source, String rejectionReason, boolean ownedByCurrentUser,
                              Instant createdAt, Instant approvedAt) {
        public static CommandView from(CommandDefinition c, List<ParameterSpec> params, Long currentUser) {
            return new CommandView(c.getId(), c.getName(), c.getDescription(), c.getCategory(), c.getAction(), c.getResourceType(),
                    c.getCommandTemplate(), params, c.getRiskLevel(), c.isRequiresApproval(), c.getStatus(), c.getSource(),
                    c.getRejectionReason(), c.getCreatedBy() != null && c.getCreatedBy().equals(currentUser), c.getCreatedAt(), c.getApprovedAt());
        }
    }
}
