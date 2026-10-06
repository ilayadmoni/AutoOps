package com.autoops.command.retrieval;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.embedding.EmbeddingService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Hybrid retrieval over APPROVED commands: pgvector cosine similarity combined with lexical overlap, with optional
 * category and maximum-risk filters and a confidence verdict.
 */
@Service
public class CommandRetrievalService {
    private static final double MATCH_THRESHOLD = 0.50;
    private static final double AMBIGUITY_GAP = 0.06;
    private final CommandDefinitionRepository repo;
    private final EmbeddingService embeddings;

    public CommandRetrievalService(CommandDefinitionRepository repo, EmbeddingService embeddings) {
        this.repo = repo;
        this.embeddings = embeddings;
    }

    public record Match(Long id, String name, String description, String category, String commandTemplate, String riskLevel,
                        double score, double semantic, double lexical) {
    }

    public record Result(String confidence, List<Match> matches) {
    }

    @Transactional(readOnly = true)
    public Result search(String query, String category, String maxRisk, Long userId) {
        if (query == null || query.isBlank()) {
            return new Result("NO_CONFIDENT_MATCH", List.of());
        }
        Map<Long, Double> semantic = new HashMap<>();
        for (Object[] row : repo.nearest(embeddings.vector(query), 30)) {
            semantic.put(((Number) row[0]).longValue(), 1.0 - ((Number) row[1]).doubleValue());
        }
        Set<String> tokens = tokens(query);
        List<CommandDefinition> candidates = new ArrayList<>(repo.findAllById(semantic.keySet()));
        // Lexical candidates ensure exact keyword hits are found even when embeddings are missing or weak.
        repo.findByStatusOrderByNameAsc(CommandDefinition.APPROVED).stream()
                .filter(c -> !semantic.containsKey(c.getId()) && lexical(c, tokens) > 0)
                .forEach(candidates::add);
        int maxRiskOrdinal = maxRisk == null || maxRisk.isBlank() ? 2 : CommandRiskAnalyzer.Risk.valueOf(maxRisk.toUpperCase(Locale.ROOT)).ordinal();
        List<Match> scored = candidates.stream()
                .filter(CommandDefinition::isApproved)
                .filter(c -> category == null || category.isBlank() || category.equalsIgnoreCase(c.getCategory()))
                .filter(c -> CommandRiskAnalyzer.Risk.valueOf(c.getRiskLevel()).ordinal() <= maxRiskOrdinal)
                .map(c -> {
                    double sem = Math.max(0, semantic.getOrDefault(c.getId(), 0.0));
                    double lex = lexical(c, tokens);
                    return new Match(c.getId(), c.getName(), c.getDescription(), c.getCategory(), c.getCommandTemplate(),
                            c.getRiskLevel(), round(0.55 * sem + 0.45 * lex), round(sem), round(lex));
                })
                .sorted(Comparator.comparingDouble(Match::score).reversed())
                .limit(5)
                .toList();
        if (scored.isEmpty() || scored.get(0).score() < MATCH_THRESHOLD) {
            return new Result("NO_CONFIDENT_MATCH", scored);
        }
        if (scored.size() > 1 && scored.get(0).score() - scored.get(1).score() < AMBIGUITY_GAP) {
            return new Result("AMBIGUOUS", scored);
        }
        return new Result("MATCH", scored);
    }

    static Set<String> tokens(String text) {
        return Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
                .filter(w -> w.length() > 2 && !STOP.contains(w))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static final Set<String> STOP = Set.of("the", "and", "for", "with", "that", "this", "from", "show", "what", "how",
            "can", "you", "please", "machine", "server", "servers", "machines", "all", "into", "want", "need");

    private static double lexical(CommandDefinition c, Set<String> tokens) {
        if (tokens.isEmpty()) {
            return 0;
        }
        Set<String> doc = tokens(String.join(" ", Objects.toString(c.getName(), ""), Objects.toString(c.getDescription(), ""),
                Objects.toString(c.getCategory(), ""), Objects.toString(c.getAction(), ""), Objects.toString(c.getCommandTemplate(), "")));
        long hits = tokens.stream().filter(t -> doc.contains(t) || doc.stream().anyMatch(d -> d.startsWith(t) || t.startsWith(d) && d.length() > 3)).count();
        return (double) hits / tokens.size();
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
