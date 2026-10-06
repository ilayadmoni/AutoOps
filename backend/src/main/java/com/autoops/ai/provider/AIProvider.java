package com.autoops.ai.provider;

import java.util.List;
import java.util.Map;

/** OpenAI-compatible chat completion with native tool calling. Providers never receive credentials of managed machines. */
public interface AIProvider {
    AIResponse chat(List<Message> messages, List<Map<String, Object>> tools);

    boolean configured();

    /** role: system, user, assistant or tool. Assistant messages may carry toolCalls; tool messages carry toolCallId. */
    record Message(String role, String content, List<ToolCall> toolCalls, String toolCallId) {
        public static Message system(String c) { return new Message("system", c, null, null); }
        public static Message user(String c) { return new Message("user", c, null, null); }
        public static Message assistant(String c) { return new Message("assistant", c, null, null); }
        public static Message assistantCalls(String c, List<ToolCall> calls) { return new Message("assistant", c, calls, null); }
        public static Message tool(String id, String c) { return new Message("tool", c, null, id); }
    }

    record ToolCall(String id, String name, String arguments) {
    }

    record AIResponse(String content, List<ToolCall> toolCalls) {
    }

    class AIUnavailableException extends RuntimeException {
        public AIUnavailableException(String message) {
            super(message);
        }
    }
}
