package com.autoops.audit.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "audit_events")
public class AuditEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id")
    private Long userId;
    @Column(nullable = false)
    private String action;
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    @Column(name = "entity_id")
    private Long entityId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long v) { userId = v; }
    public String getAction() { return action; }
    public void setAction(String v) { action = v; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String v) { entityType = v; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long v) { entityId = v; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String v) { metadata = v; }
    public Instant getCreatedAt() { return createdAt; }
}
