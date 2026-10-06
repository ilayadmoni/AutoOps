package com.autoops.ai.service;
import com.autoops.ai.provider.AIProvider;
import org.springframework.stereotype.Service;
import java.util.List;
@Service
public class AIConversationService {
  private final AIProvider provider;
  public AIConversationService(AIProvider provider){this.provider=provider;}
  public Reply ask(String message,String draftSummary){
    String system="You are the AutoOps assistant. Give concise infrastructure automation guidance. The application validates all proposed changes.";
    String context=draftSummary==null?"":"\nDraft context:\n"+draftSummary;
    var response=provider.chat(List.of(new AIProvider.Message("system",system+context),new AIProvider.Message("user",message)),List.of());
    return new Reply(response.content());
  }
  public record Reply(String message){}
}
