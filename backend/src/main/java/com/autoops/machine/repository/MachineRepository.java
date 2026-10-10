package com.autoops.machine.repository;

import com.autoops.machine.entity.Machine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {
    List<Machine> findByDeletedAtIsNullOrderByNameAsc();

    Optional<Machine> findByIdAndDeletedAtIsNull(Long id);
}
