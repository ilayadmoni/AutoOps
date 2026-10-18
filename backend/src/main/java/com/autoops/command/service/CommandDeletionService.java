package com.autoops.command.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service
public class CommandDeletionService {
    private final CommandDefinitionRepository repo;
    private final AuditService audit;

    public CommandDeletionService(CommandDefinitionRepository repo, AuditService audit) {
        this.repo = repo;
        this.audit = audit;
    }

    @Transactional
    public void delete(AuthenticatedUser user, Long id) {
        var command = repo.findById(id).orElseThrow(() -> ApiException.notFound("Command"));
        if (!user.isAdmin() && !user.id().equals(command.getCreatedBy())) {
            throw ApiException.forbidden("Only the command creator or an administrator can delete this command");
        }
        if (!repo.findReferencedIds(List.of(id)).isEmpty()) {
            throw ApiException.conflict("COMMAND_IN_USE", "Command is referenced by a workflow or execution history");
        }
        try {
            repo.delete(command);
            repo.flush();
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("COMMAND_IN_USE", "Command is referenced by another resource");
        }
        audit.record(user.id(), "COMMAND_DELETED", "COMMAND", id, Map.of("name", command.getName()));
    }
}
