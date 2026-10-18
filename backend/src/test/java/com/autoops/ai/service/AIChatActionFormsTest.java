package com.autoops.ai.service;

import com.autoops.ai.provider.AIProvider;
import com.autoops.ai.tool.AITool;
import com.autoops.ai.tool.AIToolRegistry;
import com.autoops.ai.tool.clarify.OfferActionFormTool;
import com.autoops.ai.validation.AIOperationValidator;
import com.autoops.audit.service.AuditService;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.service.CommandService;
import com.autoops.command.service.CommandTemplateService;
import com.autoops.conversation.entity.Conversation;
import com.autoops.conversation.entity.ConversationMessage;
import com.autoops.conversation.service.ConversationService;
import com.autoops.machine.service.MachineService;
import com.autoops.workflow.service.WorkflowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AIChatActionFormsTest {
    @ParameterizedTest
    @ValueSource(strings = {"RUN_WORKFLOW", "ADD_CREDENTIAL"})
    void modelCanOfferValidatedFormsWithoutSavingOrExecuting(String action) throws Exception {
        var json = new ObjectMapper();
        var provider = mock(AIProvider.class);
        when(provider.configured()).thenReturn(true);
        when(provider.chat(anyList(), anyList())).thenReturn(
                new AIProvider.AIResponse(null, List.of(new AIProvider.ToolCall("form", "offer_action_form",
                        json.writeValueAsString(Map.of("action", action, "password", "discard-this"))))),
                new AIProvider.AIResponse("Choose the required details in the form, then review and confirm.", List.of()));
        var conversations = mock(ConversationService.class);
        var conversation = mock(Conversation.class);
        when(conversation.getId()).thenReturn(7L);
        when(conversations.create(eq(1L), anyString())).thenReturn(conversation);
        when(conversations.append(anyLong(), anyString(), anyString(), any(), any())).thenReturn(mock(ConversationMessage.class));
        var workflows = mock(WorkflowService.class);
        var commands = mock(CommandService.class);
        var machines = mock(MachineService.class);
        var commandRepo = mock(CommandDefinitionRepository.class);
        var templates = mock(CommandTemplateService.class);
        var validator = new AIOperationValidator(workflows, commands, machines, json, templates, commandRepo);
        var form = new OfferActionFormTool();
        var executor = new AIToolExecutor(new AIToolRegistry(List.of(form)));
        var chat = new AIChatService(provider, executor, validator, conversations, mock(AuditService.class), json,
                new ChatAttachments(null, null, json));

        var reply = chat.ask(1L, null, "Help with " + action, null, List.of(), List.of());

        assertThat(reply.operations()).singleElement().satisfies(operation -> {
            assertThat(operation.type()).isEqualTo("OFFER_ACTION_FORM");
            assertThat(operation.payload()).isEqualTo(Map.of("action", action));
        });
        assertThat(reply.toolsUsed()).containsExactly("offer_action_form");
        assertThat(form.risk()).isEqualTo(AITool.ToolRisk.PROPOSE);
        verifyNoInteractions(workflows, commands, machines, commandRepo, templates);
    }
}
