package com.autoops.machine.repository;

import com.autoops.machine.entity.Machine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {
    List<Machine> findByCreatedByAndDeletedAtIsNullOrderByNameAsc(Long userId);

    Optional<Machine> findByIdAndCreatedByAndDeletedAtIsNull(Long id, Long userId);
}
