package com.autoops.conversation.service;

import com.autoops.common.error.ApiException;
import com.autoops.conversation.entity.Conversation;
import com.autoops.conversation.entity.ConversationMessage;
import com.autoops.conversation.repository.ConversationMessageRepository;
import com.autoops.conversation.repository.ConversationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Per-user AI conversation history. History is context for the assistant only, never authoritative state. */
@Service
public class ConversationService {
    private final ConversationRepository conversations;
    private final ConversationMessageRepository messages;
    private final ObjectMapper json;

    public ConversationService(ConversationRepository conversations, ConversationMessageRepository messages, ObjectMapper json) {
        this.conversations = conversations;
        this.messages = messages;
        this.json = json;
    }

    public record ConversationSummary(Long id, String title, Instant createdAt, Instant updatedAt) {
    }

    public record MessageView(Long id, String role, String content, List<Object> operations, List<Object> missingFields, Instant createdAt) {
    }

    public record ConversationView(Long id, String title, Instant createdAt, Instant updatedAt, List<MessageView> messages) {
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> list(Long userId) {
        return conversations.findTop50ByUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(c -> new ConversationSummary(c.getId(), c.getTitle(), c.getCreatedAt(), c.getUpdatedAt())).toList();
    }

    @Transactional(readOnly = true)
    public ConversationView get(Long userId, Long id) {
        Conversation c = require(userId, id);
        List<MessageView> list = messages.findByConversationIdOrderByIdAsc(id).stream().map(this::view).toList();
        return new ConversationView(c.getId(), c.getTitle(), c.getCreatedAt(), c.getUpdatedAt(), list);
    }

    @Transactional
    public Conversation create(Long userId, String firstMessage) {
        Conversation c = new Conversation();
        c.setUserId(userId);
        String t = firstMessage == null ? "New conversation" : firstMessage.strip().replaceAll("\\s+", " ");
        c.setTitle(t.isEmpty() ? "New conversation" : t.length() > 80 ? t.substring(0, 80) + "…" : t);
        return conversations.save(c);
    }

    @Transactional(readOnly = true)
    public Conversation require(Long userId, Long id) {
        return conversations.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Conversation"));
    }

    /** Most recent messages in chronological order, for model context. */
    @Transactional(readOnly = true)
    public List<ConversationMessage> recent(Long conversationId, int limit) {
        List<ConversationMessage> list = new ArrayList<>(messages.findByConversationIdOrderByIdDesc(conversationId, PageRequest.of(0, limit)));
        Collections.reverse(list);
        return list;
    }

    @Transactional
    public ConversationMessage append(Long conversationId, String role, String content, Object operations, Object missingFields) {
        ConversationMessage m = new ConversationMessage();
        m.setConversationId(conversationId);
        m.setRole(role);
        m.setContent(content == null ? "" : content);
        m.setOperations(operations == null ? null : write(operations));
        m.setMissingFields(missingFields == null ? null : write(missingFields));
        m = messages.save(m);
        conversations.findById(conversationId).ifPresent(c -> {
            c.setUpdatedAt(Instant.now());
            conversations.save(c);
        });
        return m;
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Conversation c = require(userId, id);
        messages.deleteByConversationId(c.getId());
        conversations.delete(c);
    }

    private MessageView view(ConversationMessage m) {
        return new MessageView(m.getId(), m.getRole(), m.getContent(), read(m.getOperations()), read(m.getMissingFields()), m.getCreatedAt());
    }

    private List<Object> read(String raw) {
        if (raw == null) {
            return List.of();
        }
        try {
            return json.readValue(raw, new TypeReference<List<Object>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
