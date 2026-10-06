package com.autoops.execution.repository;

import com.autoops.execution.entity.MachineRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MachineRunRepository extends JpaRepository<MachineRun, Long> {
    List<MachineRun> findByExecutionIdOrderByPositionAsc(Long executionId);

    List<MachineRun> findByExecutionIdIn(Collection<Long> executionIds);

    List<MachineRun> findByStatusIn(Collection<String> statuses);
}
