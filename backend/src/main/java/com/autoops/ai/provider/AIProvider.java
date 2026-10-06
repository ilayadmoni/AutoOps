package com.autoops.ai.provider;
import java.util.List; import java.util.Map;
public interface AIProvider { AIResponse chat(List<Message> messages,List<Map<String,Object>> tools); record Message(String role,String content){} record AIResponse(String content,List<Map<String,Object>> toolCalls){} }
