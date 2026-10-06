package com.autoops.execution.repository;

import com.autoops.execution.entity.StepRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StepRunRepository extends JpaRepository<StepRun, Long> {
    List<StepRun> findByMachineRunIdOrderByIdAsc(Long machineRunId);

    List<StepRun> findByMachineRunIdInOrderByIdAsc(Collection<Long> machineRunIds);

    List<StepRun> findByStatusIn(Collection<String> statuses);

    boolean existsByRetryOfStepRunId(Long stepRunId);
}
