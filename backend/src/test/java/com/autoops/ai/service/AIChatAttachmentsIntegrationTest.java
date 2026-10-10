package com.autoops.ai.service;

import com.autoops.ai.provider.AIProvider;
import com.autoops.ai.validation.AIOperationValidator;
import com.autoops.audit.service.AuditService;
import com.autoops.conversation.entity.Conversation;
import com.autoops.conversation.entity.ConversationMessage;
import com.autoops.conversation.service.ConversationService;
import com.autoops.files.service.StoredFileService;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.service.MachineService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AIChatAttachmentsIntegrationTest {
    @Test
    void selectedServerReachesModelAndPersistedHistoryWithoutConsumingMessageLimit() {
        AIProvider provider = mock(AIProvider.class);
        when(provider.configured()).thenReturn(true);
        when(provider.chat(anyList(), anyList())).thenAnswer(invocation -> {
            List<AIProvider.Message> messages = invocation.getArgument(0);
            String latest = messages.getLast().content();
            assertTrue(latest.startsWith("x".repeat(4000)));
            assertTrue(latest.contains("\"id\":8"));
            assertTrue(latest.contains("api.example"));
            return new AIProvider.AIResponse("Workflow ready for review", List.of());
        });
        Machine machine = mock(Machine.class);
        when(machine.getId()).thenReturn(8L);
        when(machine.getName()).thenReturn("Production API");
        when(machine.getHostname()).thenReturn("api.example");
        MachineService machines = mock(MachineService.class);
        when(machines.requireOwned(1L, 8L)).thenReturn(machine);
        ObjectMapper json = new ObjectMapper();
        ChatAttachments attachments = new ChatAttachments(mock(StoredFileService.class), machines, json);
        ConversationService conversations = mock(ConversationService.class);
        Conversation conversation = mock(Conversation.class);
        when(conversation.getId()).thenReturn(42L);
        when(conversations.require(1L, 42L)).thenReturn(conversation);
        when(conversations.recent(42L, 12)).thenReturn(List.of());
        when(conversations.append(eq(42L), anyString(), anyString(), any(), any())).thenReturn(mock(ConversationMessage.class));
        AIChatService chat = new AIChatService(provider, mock(AIToolExecutor.class), mock(AIOperationValidator.class),
                conversations, mock(AuditService.class), json, attachments);

        chat.ask(1L, 42L, "x".repeat(4000), null, List.of(), List.of(8L));

        verify(conversations).append(eq(42L), eq("user"), contains("\"id\":8"), isNull(), isNull());
        verify(provider).chat(anyList(), anyList());
    }
}
