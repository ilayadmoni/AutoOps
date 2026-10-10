package com.autoops.ai.service;

import com.autoops.ai.dto.AIOperation;
import com.autoops.ai.provider.AIProvider;
import com.autoops.ai.tool.clarify.AskUserTool;
import com.autoops.ai.validation.AIOperationValidator;
import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.conversation.entity.Conversation;
import com.autoops.conversation.entity.ConversationMessage;
import com.autoops.conversation.service.ConversationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;
import static com.autoops.ai.service.AIChatSupport.*;

/**
 * Bounded assistant loop: the model may call controlled tools for at most {@link #MAX_TOOL_ROUNDS} rounds using the
 * provider's native tool protocol. Proposals returned by tools are re-validated by Java and handed to the user for
 * review; nothing is saved or executed by the assistant.
 */
@Service
public class AIChatService {
    public static final int MAX_TOOL_ROUNDS = 6;
    private static final int MAX_MESSAGE = 4000;
    private static final int HISTORY = 12;

    private final AIProvider provider;
    private final AIToolExecutor tools;
    private final AIOperationValidator validator;
    private final ConversationService conversations;
    private final AuditService audit;
    private final ObjectMapper json;
    private final ChatAttachments attachments;
    private final String systemPrompt;

    public AIChatService(AIProvider provider, AIToolExecutor tools, AIOperationValidator validator, ConversationService conversations,
                         AuditService audit, ObjectMapper json, ChatAttachments attachments) {
        this.provider = provider;
        this.tools = tools;
        this.validator = validator;
        this.conversations = conversations;
        this.audit = audit;
        this.json = json;
        this.attachments = attachments;
        this.systemPrompt = String.join("\n\n", load("prompts/system/autoops-system.md"), load("prompts/workflow/workflow-builder.md"));
    }

    public record Reply(Long conversationId, Long messageId, String message, List<AIOperation> operations,
                        List<AIOperation.MissingField> missingFields, List<String> toolsUsed) {
    }

    public Reply ask(Long userId, Long conversationId, String message, String draftSummary, List<Long> fileIds, List<Long> machineIds) {
        if (message == null || message.isBlank()) {
            throw ApiException.validation("Message is required", Map.of("message", "Required"));
        }
        if (message.length() > MAX_MESSAGE) {
            throw ApiException.validation("Message is too long", Map.of("message", "Max " + MAX_MESSAGE + " characters"));
        }
        if (!provider.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE", "The AI assistant is not configured. Everything else in AutoOps works without it.");
        }
        message = message + attachments.context(userId, fileIds, machineIds);
        Conversation existing = conversationId == null ? null : conversations.require(userId, conversationId);
        List<ConversationMessage> history = existing == null ? List.of() : conversations.recent(existing.getId(), HISTORY);
        List<AIProvider.Message> msgs = ChatContext.build(json, systemPrompt, draftSummary, history, message);

        List<Map<String, Object>> rawOperations = new ArrayList<>();
        List<String> used = new ArrayList<>();
        String answer;
        try {
            answer = loop(userId, msgs, rawOperations, used);
        } catch (AIProvider.AIUnavailableException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE", e.getMessage());
        }
        List<AIOperation> operations = new ArrayList<>();
        for (Map<String, Object> raw : rawOperations) {
            validator.validate(raw, userId).ifPresent(operations::add);
        }
        List<AIOperation.MissingField> missing = operations.stream().flatMap(o -> o.missingFields().stream()).toList();
        answer = withQuestion(answer, operations);
        if (answer == null || answer.isBlank()) {
            if (operations.isEmpty()) {
                // Nothing usable came back. Fail the request so the client keeps its draft and can retry; nothing is stored.
                throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_EMPTY_RESPONSE", "The assistant returned no usable answer. Your draft is unchanged; try again.");
            }
            answer = "I prepared a proposal for you to review.";
        }
        Conversation conversation = existing != null ? existing : conversations.create(userId, ChatContext.plain(message));
        conversations.append(conversation.getId(), "user", message, null, null);
        ConversationMessage saved = conversations.append(conversation.getId(), "assistant", answer, operations.isEmpty() ? null : operations,
                missing.isEmpty() ? null : missing);
        audit.record(userId, "AI_CHAT", "CONVERSATION", conversation.getId(), Map.of("tools", String.join(",", used), "operations", operations.size()));
        return new Reply(conversation.getId(), saved.getId(), answer, operations, missing, used);
    }

    private String loop(Long userId, List<AIProvider.Message> msgs, List<Map<String, Object>> operations, List<String> used) {
        List<Map<String, Object>> schemas = tools.schemas();
        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            AIProvider.AIResponse response = provider.chat(msgs, schemas);
            if (response.toolCalls() == null || response.toolCalls().isEmpty()) {
                return response.content();
            }
            msgs.add(AIProvider.Message.assistantCalls(response.content(), response.toolCalls()));
            boolean asked = false;
            for (AIProvider.ToolCall call : response.toolCalls()) {
                used.add(call.name());
                Object result = tools.execute(call.name(), parseArgs(json, call.arguments()), userId);
                if (result instanceof Map<?, ?> m && m.get("operation") instanceof Map<?, ?> op) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> cast = (Map<String, Object>) op;
                    operations.add(cast);
                    asked |= AskUserTool.NAME.equals(call.name());
                }
                msgs.add(AIProvider.Message.tool(call.id(), bounded(json, result)));
            }
            if (asked) {
                // A clarifying question ends the turn: the user's answer arrives as their next message.
                return response.content();
            }
        }
        // Safety limit reached: ask for a final answer without offering tools.
        msgs.add(AIProvider.Message.system("Tool budget exhausted. Answer the user now using the information gathered."));
        return provider.chat(msgs, List.of()).content();
    }

}
