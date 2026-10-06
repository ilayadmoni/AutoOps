package com.autoops.ai.tool;
import org.springframework.stereotype.Component; import java.util.*;
@Component public class AIToolRegistry { private final Map<String,AITool> tools; public AIToolRegistry(List<AITool> list){Map<String,AITool> m=new HashMap<>();list.forEach(t->m.put(t.name(),t));tools=Map.copyOf(m);} public Optional<AITool> find(String name){return Optional.ofNullable(tools.get(name));} public Collection<AITool> all(){return tools.values();} }
