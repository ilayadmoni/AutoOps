package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.machine.dto.MachineDtos;
import com.autoops.machine.entity.Machine;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

@Service
public class MachineMoveService {
    private final MachineRepository repo;
    private final MachineFolderService folders;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    public MachineMoveService(MachineRepository repo, MachineFolderService folders, JdbcTemplate jdbc, AuditService audit) {
        this.repo = repo; this.folders = folders; this.jdbc = jdbc; this.audit = audit;
    }

    @Transactional
    public List<MachineDtos.Response> move(Long userId, List<Long> ids, Long folderId) {
        MachineFolderLock.acquire(jdbc);
        folders.requireExists(folderId);
        List<Machine> machines = ids.stream().distinct().sorted().map(id -> repo.findActiveForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("Machine"))).toList();
        for (Machine machine : machines) {
            machine.setFolderId(folderId);
            audit.record(userId, "MACHINE_MOVED", "MACHINE", machine.getId(), Map.of("folder", folderId == null ? "/" : folderId.toString()));
        }
        return machines.stream().map(MachineDtos.Response::from).toList();
    }
}
