package com.autoops.command.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.dto.CommandDtos;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.embedding.EmbeddingService;
import com.autoops.infrastructure.remote.ShellCommands;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CommandService {
    private final CommandDefinitionRepository repo;
    private final CommandTemplateService templates;
    private final CommandRiskAnalyzer risk;
    private final EmbeddingService embeddings;
    private final AuditService audit;

    public CommandService(CommandDefinitionRepository repo, CommandTemplateService templates, CommandRiskAnalyzer risk,
                          EmbeddingService embeddings, AuditService audit) {
        this.repo = repo;
        this.templates = templates;
        this.risk = risk;
        this.embeddings = embeddings;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CommandDtos.CommandView> list(AuthenticatedUser user, String q, String category, String riskLevel, String status) {
        List<CommandDefinition> all = user.isAdmin() ? repo.findAllByOrderByNameAsc() : repo.findVisibleTo(user.id());
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return all.stream()
                .filter(c -> category == null || category.isBlank() || category.equalsIgnoreCase(c.getCategory()))
                .filter(c -> riskLevel == null || riskLevel.isBlank() || riskLevel.equalsIgnoreCase(c.getRiskLevel()))
                .filter(c -> status == null || status.isBlank() || status.equalsIgnoreCase(c.getStatus()))
                .filter(c -> query.isEmpty() || haystack(c).contains(query))
                .map(c -> view(c, user.id()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CommandDtos.CommandView get(AuthenticatedUser user, Long id) {
        return view(requireVisible(user, id), user.id());
    }

    @Transactional
    public CommandDtos.CommandView create(AuthenticatedUser user, CommandDtos.Create x) {
        String template = x.commandTemplate().strip();
        List<ParameterSpec> specs = templates.validateTemplate(template, x.parameters());
        if (repo.existsByNormalizedTemplate(CommandDefinition.normalize(template))) {
            throw ApiException.conflict("DUPLICATE_COMMAND", "An identical command template already exists in the Command Bank");
        }
        var c = new CommandDefinition();
        c.setName(x.name().trim());
        c.setDescription(blankToNull(x.description()));
        c.setCategory(x.category() == null || x.category().isBlank() ? "SYSTEM" : x.category().trim().toUpperCase(Locale.ROOT));
        c.setAction(blankToNull(x.action()));
        c.setResourceType(blankToNull(x.resourceType()));
        c.setCommandTemplate(template);
        c.setParametersSchema(templates.serialize(specs));
        var r = risk.analyze(template);
        c.setRiskLevel(r.name());
        c.setRequiresApproval(r == CommandRiskAnalyzer.Risk.HIGH);
        c.setCreatedBy(user.id());
        c.setSource(user.isAdmin() ? "ADMIN" : "USER");
        // New commands are usable immediately; HIGH-risk ones still require approval on every run (requiresApproval).
        c.setStatus(CommandDefinition.APPROVED);
        c.setApprovedBy(user.id());
        c.setApprovedAt(Instant.now());
        c = repo.save(c);
        embeddings.index(c);
        audit.record(user.id(), "COMMAND_CREATED", "COMMAND", c.getId(), Map.of("name", c.getName(), "risk", c.getRiskLevel(), "status", c.getStatus()));
        return view(c, user.id());
    }

    @Transactional(readOnly = true)
    public CommandDtos.PreviewResult preview(AuthenticatedUser user, Long id, Map<String, String> parameters, boolean sudo) {
        var c = requireVisible(user, id);
        String resolved = templates.resolve(c.getCommandTemplate(), specs(c), parameters);
        var base = CommandRiskAnalyzer.Risk.valueOf(c.getRiskLevel());
        var effective = CommandRiskAnalyzer.withSudo(base, sudo);
        return new CommandDtos.PreviewResult(c.getId(), resolved, sudo ? ShellCommands.withSudo(resolved) : resolved,
                base.name(), effective.name(), effective == CommandRiskAnalyzer.Risk.HIGH);
    }

    /** Loads a command that may be executed: it must exist and be APPROVED. */
    @Transactional(readOnly = true)
    public CommandDefinition requireRunnable(Long id) {
        var c = repo.findById(id).orElseThrow(() -> ApiException.notFound("Command"));
        if (!c.isApproved()) {
            throw ApiException.conflict("COMMAND_NOT_APPROVED", "Command '" + c.getName() + "' is not approved for execution");
        }
        return c;
    }

    public List<ParameterSpec> specs(CommandDefinition c) {
        return templates.parse(c.getParametersSchema(), c.getCommandTemplate());
    }

    private CommandDefinition requireVisible(AuthenticatedUser user, Long id) {
        var c = repo.findById(id).orElseThrow(() -> ApiException.notFound("Command"));
        if (!user.isAdmin() && !c.isApproved() && !user.id().equals(c.getCreatedBy())) {
            throw ApiException.notFound("Command");
        }
        return c;
    }

    private CommandDtos.CommandView view(CommandDefinition c, Long user) {
        return CommandDtos.CommandView.from(c, specs(c), user);
    }

    private static String haystack(CommandDefinition c) {
        return String.join(" ", s(c.getName()), s(c.getDescription()), s(c.getCategory()), s(c.getCommandTemplate()),
                s(c.getAction()), s(c.getResourceType())).toLowerCase(Locale.ROOT);
    }

    private static String s(String v) {
        return v == null ? "" : v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
