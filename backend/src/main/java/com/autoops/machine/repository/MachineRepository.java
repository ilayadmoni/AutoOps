package com.autoops.machine.repository;
import com.autoops.machine.entity.Machine; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface MachineRepository extends JpaRepository<Machine,Long>{ List<Machine> findByCreatedByAndDeletedAtIsNull(Long userId); }
