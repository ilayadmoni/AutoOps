package com.autoops.machine.repository;

import com.autoops.machine.entity.Machine;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MachineRepository extends JpaRepository<Machine, Long> {
    List<Machine> findByDeletedAtIsNullOrderByNameAsc();

    Optional<Machine> findByIdAndDeletedAtIsNull(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Machine m where m.id = :id and m.deletedAt is null")
    Optional<Machine> findActiveForUpdate(@Param("id") Long id);
}
