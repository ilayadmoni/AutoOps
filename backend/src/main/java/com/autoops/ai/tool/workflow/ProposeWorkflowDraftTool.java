package com.autoops.ai.tool.workflow;
import com.autoops.ai.tool.AITool;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class ProposeWorkflowDraftTool implements AITool {
  public String name(){return "propose_workflow_draft";}
  public ToolRisk risk(){return ToolRisk.PROPOSE;}
  public Map<String,Object> schema(){return Map.of("type","object","properties",Map.of("name",Map.of("type","string"),"description",Map.of("type","string"),"nodes",Map.of("type","array","items",Map.of("type","object"))),"required",List.of("name","nodes"));}
  public Object execute(Map<String,Object> args,Long user){
    String name=Objects.toString(args.get("name"),"New workflow");
    Object nodes=args.getOrDefault("nodes",List.of());
    return Map.of("operation",Map.of("type","REPLACE_WORKFLOW_DRAFT","payload",Map.of("name",name,"description",Objects.toString(args.get("description"),""),"nodes",nodes)),"requiresUserConfirmation",true);
  }
}
