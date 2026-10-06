package com.autoops.command.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Locale;

@Entity
@Table(name = "command_definitions")
public class CommandDefinition {
    public static final String APPROVED = "APPROVED";
    public static final String PENDING = "PENDING";
    public static final String REJECTED = "REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    private String description;
    private String category;
    private String action;
    @Column(name = "resource_type")
    private String resourceType;
    @Column(name = "command_template", nullable = false, columnDefinition = "text")
    private String commandTemplate;
    @Column(name = "normalized_template", columnDefinition = "text")
    private String normalizedTemplate;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters_schema", columnDefinition = "jsonb")
    private String parametersSchema;
    @Column(name = "supported_os")
    private String supportedOs;
    @Column(name = "risk_level", nullable = false)
    private String riskLevel = "LOW";
    @Column(name = "requires_approval", nullable = false)
    private boolean requiresApproval;
    @Column(nullable = false)
    private String status = PENDING;
    @Column(nullable = false)
    private String source = "USER";
    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;
    @Column(name = "embedding_text")
    private String embeddingText;
    @Column(name = "embedding_provider")
    private String embeddingProvider;
    @Column(name = "embedding_model")
    private String embeddingModel;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;
    @Column(name = "approved_by")
    private Long approvedBy;
    @Column(name = "approved_at")
    private Instant approvedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public static String normalize(String template) {
        return template == null ? null : template.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    @PrePersist
    @PreUpdate
    void beforeSave() {
        normalizedTemplate = normalize(commandTemplate);
        updatedAt = Instant.now();
    }

    public boolean isApproved() {
        return APPROVED.equals(status);
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String v) { name = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { description = v; }
    public String getCategory() { return category; }
    public void setCategory(String v) { category = v; }
    public String getAction() { return action; }
    public void setAction(String v) { action = v; }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String v) { resourceType = v; }
    public String getCommandTemplate() { return commandTemplate; }
    public void setCommandTemplate(String v) { commandTemplate = v; }
    public String getParametersSchema() { return parametersSchema; }
    public void setParametersSchema(String v) { parametersSchema = v; }
    public String getSupportedOs() { return supportedOs; }
    public void setSupportedOs(String v) { supportedOs = v; }
    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { riskLevel = v; }
    public boolean isRequiresApproval() { return requiresApproval; }
    public void setRequiresApproval(boolean v) { requiresApproval = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getSource() { return source; }
    public void setSource(String v) { source = v; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String v) { rejectionReason = v; }
    public String getEmbeddingText() { return embeddingText; }
    public void setEmbeddingText(String v) { embeddingText = v; }
    public String getEmbeddingProvider() { return embeddingProvider; }
    public void setEmbeddingProvider(String v) { embeddingProvider = v; }
    public String getEmbeddingModel() { return embeddingModel; }
    public void setEmbeddingModel(String v) { embeddingModel = v; }
    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long v) { createdBy = v; }
    public Long getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Long v) { approvedBy = v; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant v) { approvedAt = v; }
    public Instant getCreatedAt() { return createdAt; }
}
