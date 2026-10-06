package com.autoops.conversation.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "conversation_messages")
public class ConversationMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;
    @Column(nullable = false)
    private String role;
    @Column(nullable = false, columnDefinition = "text")
    private String content;
    /** Proposed operations shown to the user; informational only, never authoritative workflow state. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String operations;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_fields", columnDefinition = "jsonb")
    private String missingFields;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long v) { conversationId = v; }
    public String getRole() { return role; }
    public void setRole(String v) { role = v; }
    public String getContent() { return content; }
    public void setContent(String v) { content = v; }
    public String getOperations() { return operations; }
    public void setOperations(String v) { operations = v; }
    public String getMissingFields() { return missingFields; }
    public void setMissingFields(String v) { missingFields = v; }
    public Instant getCreatedAt() { return createdAt; }
}
