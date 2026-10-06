package com.autoops.workflow.repository;

import com.autoops.workflow.entity.WorkflowStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WorkflowStepRepository extends JpaRepository<WorkflowStep, Long> {
    List<WorkflowStep> findByWorkflowIdAndRetiredAtIsNullOrderByPositionAsc(Long workflowId);

    List<WorkflowStep> findByWorkflowId(Long workflowId);

    @Query(value = "SELECT count(*) > 0 FROM step_runs WHERE workflow_step_id = :id", nativeQuery = true)
    boolean hasRuns(@Param("id") Long stepId);
}
