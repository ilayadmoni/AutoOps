package com.autoops.ai.tool.execution;
import com.autoops.ai.tool.AITool;
import com.autoops.execution.repository.ExecutionRepository;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class GetExecutionTool implements AITool {
  private final ExecutionRepository repo;
  public GetExecutionTool(ExecutionRepository repo){this.repo=repo;}
  public String name(){return "get_execution";}
  public ToolRisk risk(){return ToolRisk.READ;}
  public Map<String,Object> schema(){return Map.of("type","object","properties",Map.of("executionId",Map.of("type","integer")),"required",List.of("executionId"));}
  public Object execute(Map<String,Object> args,Long user){
    Long id=((Number)args.get("executionId")).longValue();
    var e=repo.findById(id).orElseThrow();
    if(!user.equals(e.getStartedBy()))throw new SecurityException("Execution not owned by current user");
    return Map.of("id",e.getId(),"type",e.getType(),"mode",e.getMode(),"status",e.getStatus());
  }
}
