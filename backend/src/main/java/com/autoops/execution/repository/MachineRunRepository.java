package com.autoops.execution.repository;

import com.autoops.execution.entity.MachineRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface MachineRunRepository extends JpaRepository<MachineRun, Long> {
    List<MachineRun> findByExecutionIdOrderByPositionAsc(Long executionId);

    List<MachineRun> findByExecutionIdIn(Collection<Long> executionIds);

    List<MachineRun> findByStatusIn(Collection<String> statuses);

    /** Match execution-history visibility. Queued/skipped targets that never started do not count. */
    @Query(value = """
            select distinct mr.machine_id from machine_runs mr
            join executions e on e.id = mr.execution_id
            where e.workflow_id = :workflowId and mr.started_at is not null
              and (:admin = true or e.started_by = :userId)
            order by mr.machine_id
            """, nativeQuery = true)
    List<Long> findPreviouslyRunMachineIds(@Param("workflowId") Long workflowId,
            @Param("userId") Long userId, @Param("admin") boolean admin);
}
