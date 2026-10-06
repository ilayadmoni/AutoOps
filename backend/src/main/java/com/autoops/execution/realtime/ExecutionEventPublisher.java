package com.autoops.execution.realtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Fan-out of execution events to SSE subscribers. Authorization is enforced before subscribe() is called. */
@Component
public class ExecutionEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(ExecutionEventPublisher.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;
    private final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long executionId) {
        SseEmitter e = new SseEmitter(TIMEOUT_MS);
        emitters.computeIfAbsent(executionId, k -> new CopyOnWriteArrayList<>()).add(e);
        e.onCompletion(() -> remove(executionId, e));
        e.onTimeout(() -> remove(executionId, e));
        e.onError(x -> remove(executionId, e));
        try {
            e.send(SseEmitter.event().name("CONNECTED").data(Map.of("type", "CONNECTED", "executionId", executionId, "at", Instant.now().toString())));
        } catch (Exception ex) {
            remove(executionId, e);
        }
        return e;
    }

    public void publish(Long executionId, String type, Map<String, ?> data) {
        List<SseEmitter> list = emitters.get(executionId);
        if (list == null || list.isEmpty()) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("executionId", executionId);
        body.put("at", Instant.now().toString());
        if (data != null) {
            body.putAll(data);
        }
        for (SseEmitter e : list) {
            try {
                e.send(SseEmitter.event().name(type).data(body));
            } catch (Exception ex) {
                remove(executionId, e);
            }
        }
    }

    /** Closes the streams of a finished execution after delivering the final event. */
    public void complete(Long executionId) {
        List<SseEmitter> list = emitters.remove(executionId);
        if (list != null) {
            list.forEach(e -> {
                try {
                    e.complete();
                } catch (Exception ignored) {
                    // already closed
                }
            });
        }
    }

    @Scheduled(fixedDelay = 15000)
    public void heartbeat() {
        emitters.forEach((id, list) -> list.forEach(e -> {
            try {
                e.send(SseEmitter.event().comment("keepalive"));
            } catch (Exception ex) {
                remove(id, e);
            }
        }));
    }

    private void remove(Long id, SseEmitter e) {
        List<SseEmitter> list = emitters.get(id);
        if (list != null) {
            list.remove(e);
            if (list.isEmpty()) {
                emitters.remove(id, list);
            }
        }
        log.trace("SSE subscriber removed for execution {}", id);
    }
}
