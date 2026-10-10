package com.autoops.ai.service;

import com.autoops.ai.provider.AIProvider;
import com.autoops.ai.validation.AIOperationValidator;
import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.conversation.entity.Conversation;
import com.autoops.conversation.entity.ConversationMessage;
import com.autoops.conversation.service.ConversationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AIChatRecoveryTest {
    private final ObjectMapper json = new ObjectMapper();
    private AIProvider provider;
    private ConversationService conversations;
    private AIChatService chat;

    @BeforeEach
    void setUp() {
        provider = mock(AIProvider.class);
        when(provider.configured()).thenReturn(true);
        conversations = mock(ConversationService.class);
        Conversation conversation = mock(Conversation.class);
        when(conversation.getId()).thenReturn(7L);
        when(conversations.require(1L, 7L)).thenReturn(conversation);
        when(conversations.create(eq(1L), anyString())).thenReturn(conversation);
        when(conversations.append(anyLong(), anyString(), anyString(), any(), any())).thenReturn(mock(ConversationMessage.class));
        chat = new AIChatService(provider, mock(AIToolExecutor.class), mock(AIOperationValidator.class), conversations,
                mock(AuditService.class), json, new ChatAttachments(null, null, json));
    }

    @Test
    void emptyAnswerIsARecoverableErrorAndStoresNothing() {
        when(provider.chat(anyList(), anyList())).thenReturn(new AIProvider.AIResponse("  ", List.of()));

        ApiException error = assertThrows(ApiException.class, () -> chat.ask(1L, null, "Build a workflow", "{}", null, null));

        assertEquals("AI_EMPTY_RESPONSE", error.code());
        verify(conversations, never()).create(anyLong(), anyString());
        verify(conversations, never()).append(anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    void followUpCarriesEditedDraftAndEarlierProposals() {
        ConversationMessage earlier = mock(ConversationMessage.class);
        when(earlier.getRole()).thenReturn("assistant");
        when(earlier.getContent()).thenReturn("Draft ready");
        when(earlier.getOperations()).thenReturn("[{\"type\":\"REPLACE_WORKFLOW_DRAFT\",\"payload\":{\"name\":\"Deploy\",\"nodes\":[{},{}]},"
                + "\"missingFields\":[{\"field\":\"commandDefinitionId\"}]}]");
        when(conversations.recent(7L, 12)).thenReturn(List.of(earlier));
        when(provider.chat(anyList(), anyList())).thenReturn(new AIProvider.AIResponse("Updated", List.of()));

        chat.ask(1L, 7L, "Add a restart step", "{\"name\":\"Hand edited\"}", null, null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AIProvider.Message>> sent = ArgumentCaptor.forClass(List.class);
        verify(provider).chat(sent.capture(), anyList());
        List<AIProvider.Message> messages = sent.getValue();
        assertTrue(messages.stream().anyMatch(m -> "system".equals(m.role()) && m.content().contains("Hand edited")));
        assertTrue(messages.stream().anyMatch(m -> "assistant".equals(m.role())
                && m.content().contains("Proposed workflow draft \"Deploy\" with 2 steps") && m.content().contains("commandDefinitionId")));
    }

    @Test
    void failedFirstRequestDoesNotCreateAConversation() {
        when(provider.chat(anyList(), anyList())).thenThrow(new AIProvider.AIUnavailableException("down"));

        assertThrows(ApiException.class, () -> chat.ask(1L, null, "Build it", null, null, null));

        verify(conversations, never()).create(anyLong(), anyString());
    }

    @Test
    void titleShowsTagLabelsNotIds() {
        assertEquals("Deploy to @Prod [1] with #run.sh", ChatContext.plain("Deploy to @[Prod \\[1\\]](server:8) with #[run.sh](file:31)"));
    }
}
