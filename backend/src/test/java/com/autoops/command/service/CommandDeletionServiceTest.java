package com.autoops.command.service;

import com.autoops.audit.service.AuditService;
import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CommandDeletionServiceTest {
    private final CommandDefinitionRepository repo = mock(CommandDefinitionRepository.class);
    private final AuditService audit = mock(AuditService.class);
    private final CommandDeletionService service = new CommandDeletionService(repo, audit);
    private final AuthenticatedUser owner = new AuthenticatedUser(7L, "owner", "USER");

    private CommandDefinition command() {
        var c = new CommandDefinition(); c.setName("Check disk"); c.setCreatedBy(7L);
        when(repo.findById(9L)).thenReturn(Optional.of(c));
        return c;
    }

    @Test void creatorCanDeleteAndDeletionIsAudited() {
        var c = command();
        service.delete(owner, 9L);
        verify(repo).delete(c); verify(repo).flush();
        verify(audit).record(eq(7L), eq("COMMAND_DELETED"), eq("COMMAND"), eq(9L), anyMap());
    }

    @Test void adminCanDeleteAnotherUsersCommand() {
        var c = command();
        service.delete(new AuthenticatedUser(8L, "admin", "ADMIN"), 9L);
        verify(repo).delete(c);
    }

    @Test void otherUsersCannotDeleteSharedCommands() {
        command();
        var error = assertThrows(ApiException.class, () -> service.delete(new AuthenticatedUser(8L, "other", "USER"), 9L));
        assertEquals("FORBIDDEN", error.code());
        verify(repo, never()).delete(any()); verifyNoInteractions(audit);
    }

    @Test void preservesCommandsUsedByWorkflowsOrHistory() {
        command(); when(repo.findReferencedIds(List.of(9L))).thenReturn(List.of(9L));
        assertEquals("COMMAND_IN_USE", assertThrows(ApiException.class, () -> service.delete(owner, 9L)).code());
        verify(repo, never()).delete(any()); verifyNoInteractions(audit);
    }

    @Test void referenceRacesReturnAUsefulConflict() {
        command(); doThrow(new DataIntegrityViolationException("fk")).when(repo).flush();
        assertEquals("COMMAND_IN_USE", assertThrows(ApiException.class, () -> service.delete(owner, 9L)).code());
        verifyNoInteractions(audit);
    }
}
