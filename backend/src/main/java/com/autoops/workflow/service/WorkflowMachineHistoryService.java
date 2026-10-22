package com.autoops.workflow.service;

import com.autoops.common.security.AuthenticatedUser;
import com.autoops.execution.repository.MachineRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class WorkflowMachineHistoryService {
    private final WorkflowService workflows;
    private final MachineRunRepository runs;
    public WorkflowMachineHistoryService(WorkflowService workflows, MachineRunRepository runs) {
        this.workflows = workflows; this.runs = runs;
    }

    @Transactional(readOnly = true)
    public List<Long> machines(AuthenticatedUser user, Long workflowId) {
        workflows.requireOwned(user.id(), workflowId);
        return runs.findPreviouslyRunMachineIds(workflowId, user.id(), user.isAdmin());
    }
}
