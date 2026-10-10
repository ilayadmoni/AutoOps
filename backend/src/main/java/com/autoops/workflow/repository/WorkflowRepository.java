package com.autoops.workflow.repository;

import com.autoops.workflow.entity.Workflow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkflowRepository extends JpaRepository<Workflow, Long> {
    List<Workflow> findByDeletedAtIsNullOrderByUpdatedAtDesc();

    Optional<Workflow> findByIdAndDeletedAtIsNull(Long id);
}
