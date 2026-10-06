package com.autoops.execution.repository;

import com.autoops.execution.entity.Execution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ExecutionRepository extends JpaRepository<Execution, Long> {
    Page<Execution> findByStartedByOrderByIdDesc(Long userId, Pageable pageable);

    Page<Execution> findAllByOrderByIdDesc(Pageable pageable);

    List<Execution> findByStatusIn(Collection<String> statuses);
}
