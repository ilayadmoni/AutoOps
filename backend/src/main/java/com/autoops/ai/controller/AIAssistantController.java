package com.autoops.ai.controller;
import com.autoops.ai.service.AIConversationService;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/ai")
public class AIAssistantController {
  private final AIConversationService service;
  public AIAssistantController(AIConversationService service){this.service=service;}
  public record Request(String message,String draftSummary){}
  @PostMapping("/chat")
  public AIConversationService.Reply chat(@RequestBody Request request){return service.ask(request.message(),request.draftSummary());}
}
