package com.autoops.workflow.service;

import com.autoops.common.error.ApiException;
import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.repository.MachineRunRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkflowMachineHistoryServiceTest {
    private final WorkflowService workflows = mock(WorkflowService.class);
    private final MachineRunRepository runs = mock(MachineRunRepository.class);
    private final WorkflowMachineHistoryService service = new WorkflowMachineHistoryService(workflows, runs);

    @Test void scopesHistoryToTheCurrentUserAndWorkflow() {
        when(runs.findPreviouslyRunMachineIds(9L, 7L, false)).thenReturn(List.of(2L, 3L));
        assertEquals(List.of(2L, 3L), service.machines(new AuthenticatedUser(7L, "operator", "USER"), 9L));
        verify(workflows).requireOwned(7L, 9L);
        verify(runs).findPreviouslyRunMachineIds(9L, 7L, false);
    }

    @Test void allowsAdministratorsToReadTheHistoryTheyCanAlreadyAccess() {
        when(runs.findPreviouslyRunMachineIds(9L, 7L, true)).thenReturn(List.of(2L));
        assertEquals(List.of(2L), service.machines(new AuthenticatedUser(7L, "admin", "ADMIN"), 9L));
    }

    @Test void missingOrDeletedWorkflowsDoNotExposeHistory() {
        when(workflows.requireOwned(7L, 9L)).thenThrow(ApiException.notFound("Workflow"));
        assertThrows(ApiException.class, () -> service.machines(new AuthenticatedUser(7L, "operator", "USER"), 9L));
        verifyNoInteractions(runs);
    }
}
