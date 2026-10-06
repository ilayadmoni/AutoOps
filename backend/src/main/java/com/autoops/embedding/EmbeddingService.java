package com.autoops.embedding;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class EmbeddingService {
    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);
    private final EmbeddingProvider provider;
    private final CommandDefinitionRepository commands;
    @PersistenceContext
    private EntityManager em;

    private final TransactionTemplate tx;

    public EmbeddingService(EmbeddingProvider provider, CommandDefinitionRepository commands, TransactionTemplate tx) {
        this.provider = provider;
        this.commands = commands;
        this.tx = tx;
    }

    public String vector(String text) {
        float[] v = provider.embed(text);
        return IntStream.range(0, v.length).mapToObj(i -> Float.toString(v[i])).collect(Collectors.joining(",", "[", "]"));
    }

    /** Deterministic text: the same command always yields the same embedding input. */
    public static String embeddingText(CommandDefinition c) {
        return String.join(" | ", safe(c.getName()), safe(c.getDescription()), safe(c.getCategory()), safe(c.getAction()),
                safe(c.getResourceType()), safe(c.getCommandTemplate())).trim();
    }

    /** Indexes one command. Failures are logged and leave the command searchable lexically. */
    @Transactional
    public boolean index(CommandDefinition c) {
        String text = embeddingText(c);
        String vec;
        try {
            vec = vector(text);
        } catch (RuntimeException e) {
            log.warn("Embedding failed for command {}: {}", c.getId(), e.getMessage());
            return false;
        }
        em.createNativeQuery("UPDATE command_definitions SET embedding = CAST(:v AS vector), embedding_text = :t, "
                        + "embedding_provider = :p, embedding_model = :m WHERE id = :id")
                .setParameter("v", vec).setParameter("t", text).setParameter("p", provider.provider())
                .setParameter("m", provider.model()).setParameter("id", c.getId()).executeUpdate();
        return true;
    }

    public int reindexAll() {
        int ok = 0;
        for (Long id : commands.findAllIds()) {
            // One short transaction per command so a failure never rolls back the others.
            Boolean done = tx.execute(s -> commands.findById(id).map(this::index).orElse(false));
            if (Boolean.TRUE.equals(done)) {
                ok++;
            }
        }
        return ok;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> status() {
        Object[] row = (Object[]) em.createNativeQuery("""
                SELECT count(*), count(embedding),
                       count(*) FILTER (WHERE embedding IS NOT NULL AND (embedding_provider IS DISTINCT FROM :p OR embedding_model IS DISTINCT FROM :m))
                FROM command_definitions""").setParameter("p", provider.provider()).setParameter("m", provider.model()).getSingleResult();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("provider", provider.provider());
        out.put("model", provider.model());
        out.put("dimensions", EmbeddingProvider.DIMENSIONS);
        out.put("commands", ((Number) row[0]).longValue());
        out.put("indexed", ((Number) row[1]).longValue());
        out.put("missing", ((Number) row[0]).longValue() - ((Number) row[1]).longValue());
        out.put("stale", ((Number) row[2]).longValue());
        return out;
    }

    private static String safe(String x) {
        return x == null ? "" : x;
    }
}
