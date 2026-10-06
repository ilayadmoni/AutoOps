package com.autoops.execution.repository;

import com.autoops.execution.entity.PreflightRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PreflightRunRepository extends JpaRepository<PreflightRun, Long> {
    List<PreflightRun> findByMachineRunIdInOrderByIdAsc(Collection<Long> machineRunIds);

    List<PreflightRun> findByStatusIn(Collection<String> statuses);
}
