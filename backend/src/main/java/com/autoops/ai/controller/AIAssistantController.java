package com.autoops.ai.controller;

import com.autoops.ai.provider.AIProvider;
import com.autoops.ai.service.AIChatService;
import com.autoops.common.security.CurrentUser;
import com.autoops.conversation.service.ConversationService;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AIAssistantController {
    private final AIChatService chat;
    private final ConversationService conversations;
    private final AIProvider provider;
    private final CurrentUser current;

    public AIAssistantController(AIChatService chat, ConversationService conversations, AIProvider provider, CurrentUser current) {
        this.chat = chat;
        this.conversations = conversations;
        this.provider = provider;
        this.current = current;
    }

    public record ChatRequest(Long conversationId, @Size(max = 4000) String message, @Size(max = 20000) String draftSummary) {
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of("configured", provider.configured());
    }

    @PostMapping("/chat")
    public AIChatService.Reply chat(@RequestBody ChatRequest r) {
        return chat.ask(current.id(), r.conversationId(), r.message(), r.draftSummary());
    }

    @GetMapping("/conversations")
    public List<ConversationService.ConversationSummary> list() {
        return conversations.list(current.id());
    }

    @GetMapping("/conversations/{id}")
    public ConversationService.ConversationView get(@PathVariable Long id) {
        return conversations.get(current.id(), id);
    }

    @DeleteMapping("/conversations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        conversations.delete(current.id(), id);
    }
}
