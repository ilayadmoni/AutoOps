package com.autoops.ai.provider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.http.HttpClient;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.*;

/** OpenRouter / OpenAI-compatible provider using the native tools / tool_calls / tool-role message protocol. */
@Service
public class OpenRouterAIProvider implements AIProvider {
    private static final Logger log = LoggerFactory.getLogger(OpenRouterAIProvider.class);
    private final RestClient client;
    private final String model;
    private final boolean configured;

    public OpenRouterAIProvider(@Value("${autoops.ai.base-url}") String url, @Value("${autoops.ai.api-key:}") String key,
                                @Value("${autoops.ai.model:}") String model, @Value("${autoops.ai.ssl-verify:true}") boolean sslVerify) {
        this.model = model;
        this.configured = key != null && !key.isBlank() && model != null && !model.isBlank();
        HttpClient.Builder http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(10));
        if (!sslVerify) {
            log.warn("AI_SSL_VERIFY=false: TLS certificates of the AI provider are NOT verified. Use only behind a trusted inspection proxy.");
            http.sslContext(trustAll());
        }
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http.build());
        factory.setReadTimeout(Duration.ofSeconds(120));
        // Buffer bodies so a Content-Length is always sent (some gateways reject chunked uploads).
        this.client = RestClient.builder().baseUrl(url).requestFactory(new BufferingClientHttpRequestFactory(factory))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + (key == null ? "" : key))
                .defaultHeader("X-Title", "AutoOps")
                .build();
    }

    @Override
    public boolean configured() {
        return configured;
    }

    @Override
    @SuppressWarnings("unchecked")
    public AIResponse chat(List<Message> messages, List<Map<String, Object>> tools) {
        if (!configured) {
            throw new AIUnavailableException("The AI assistant is not configured (AI_API_KEY / AI_MODEL)");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages.stream().map(OpenRouterAIProvider::wire).toList());
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }
        Map<String, Object> r;
        try {
            r = client.post().uri("/chat/completions").contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class);
        } catch (RestClientException e) {
            log.warn("AI provider request failed: {}", e.getMessage());
            throw new AIUnavailableException("The AI provider is unavailable right now");
        }
        if (r == null || !(r.get("choices") instanceof List<?> choices) || choices.isEmpty()) {
            throw new AIUnavailableException("The AI provider returned an empty response");
        }
        Map<String, Object> msg = (Map<String, Object>) ((Map<String, Object>) choices.get(0)).get("message");
        if (msg == null) {
            throw new AIUnavailableException("The AI provider returned an empty response");
        }
        String content = extractContent(msg.get("content"));
        if (content.isBlank() && msg.get("refusal") instanceof String refusal) {
            content = refusal;
        }
        List<ToolCall> calls = new ArrayList<>();
        if (msg.get("tool_calls") instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> call && call.get("function") instanceof Map<?, ?> fn) {
                    calls.add(new ToolCall(Objects.toString(call.get("id"), UUID.randomUUID().toString()),
                            Objects.toString(fn.get("name"), ""), Objects.toString(fn.get("arguments"), "{}")));
                }
            }
        }
        if (content.isBlank() && calls.isEmpty()) {
            Object reason = ((Map<String, Object>) choices.get(0)).get("finish_reason");
            log.warn("AI provider returned neither text nor tool calls (finish_reason={})", reason);
        }
        return new AIResponse(content, calls);
    }

    /** Chat content is a string, or on some gateways a list of typed parts; only text parts are answer text. */
    static String extractContent(Object content) {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof List<?> parts) {
            StringBuilder out = new StringBuilder();
            for (Object part : parts) {
                if (part instanceof Map<?, ?> p && p.get("text") instanceof String text) {
                    out.append(text);
                }
            }
            return out.toString();
        }
        return "";
    }

    private static Map<String, Object> wire(Message m) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("role", m.role());
        out.put("content", m.content() == null ? "" : m.content());
        if (m.toolCalls() != null && !m.toolCalls().isEmpty()) {
            out.put("tool_calls", m.toolCalls().stream().map(c -> Map.of("id", c.id(), "type", "function",
                    "function", Map.of("name", c.name(), "arguments", c.arguments()))).toList());
        }
        if (m.toolCallId() != null) {
            out.put("tool_call_id", m.toolCallId());
        }
        return out;
    }

    private static SSLContext trustAll() {
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] chain, String authType) { }
                public void checkServerTrusted(X509Certificate[] chain, String authType) { }
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }}, null);
            return ctx;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
