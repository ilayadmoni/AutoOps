package com.autoops.machine.repository;

import com.autoops.machine.entity.MachineFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MachineFolderRepository extends JpaRepository<MachineFolder, Long> {
    Optional<MachineFolder> findByPath(String path);
    List<MachineFolder> findAllByOrderByPathAsc();
}
