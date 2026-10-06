package com.autoops.ai.tool;
import java.util.Map;
public interface AITool { String name(); ToolRisk risk(); Map<String,Object> schema(); Object execute(Map<String,Object> arguments,Long userId); enum ToolRisk{READ,PROPOSE,VALIDATE} }
