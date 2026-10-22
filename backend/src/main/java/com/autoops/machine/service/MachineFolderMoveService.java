package com.autoops.machine.service;

import com.autoops.audit.service.AuditService;
import com.autoops.common.error.ApiException;
import com.autoops.machine.entity.MachineFolder;
import com.autoops.machine.repository.MachineFolderRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class MachineFolderMoveService {
    private final MachineFolderRepository repo;
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public MachineFolderMoveService(MachineFolderRepository repo, JdbcTemplate jdbc, AuditService audit) {
        this.repo = repo; this.jdbc = jdbc; this.audit = audit;
    }

    @Transactional
    public void move(Long userId, Long id, Long destinationId) {
        MachineFolderLock.acquire(jdbc);
        MachineFolder source = repo.findById(id).orElseThrow(() -> ApiException.notFound("Machine folder"));
        MachineFolder destination = destinationId == null ? null : repo.findById(destinationId)
                .orElseThrow(() -> ApiException.notFound("Destination folder"));
        String oldPath = source.getPath();
        if (destination != null && (destination.getPath().equals(oldPath) || destination.getPath().startsWith(oldPath + "/")))
            throw ApiException.validation("A folder cannot be moved inside itself or its descendants");
        String newPath = destination == null ? source.getName() : destination.getPath() + "/" + source.getName();
        if (Objects.equals(source.getParentId(), destinationId)) return;
        List<MachineFolder> all = repo.findAllByOrderByPathAsc();
        List<MachineFolder> subtree = all.stream()
                .filter(f -> f.getPath().equals(oldPath) || f.getPath().startsWith(oldPath + "/")).toList();
        Set<Long> ids = new HashSet<>(subtree.stream().map(MachineFolder::getId).toList());
        Set<String> occupied = new HashSet<>(all.stream().filter(f -> !ids.contains(f.getId())).map(MachineFolder::getPath).toList());
        for (MachineFolder folder : subtree) {
            String path = newPath + folder.getPath().substring(oldPath.length());
            if (path.length() > 1000) throw ApiException.validation("Destination folder path exceeds 1000 characters");
            if (occupied.contains(path)) throw ApiException.conflict("FOLDER_EXISTS", "A folder with this name already exists at the destination");
        }
        // All validation precedes mutations; stable folder IDs preserve machines and favorites.
        for (MachineFolder folder : subtree) {
            folder.moveTo(newPath + folder.getPath().substring(oldPath.length()),
                    folder.getId().equals(id) ? destinationId : folder.getParentId());
        }
        repo.flush();
        audit.record(userId, "MACHINE_FOLDER_MOVED", "MACHINE_FOLDER", id,
                Map.of("from", oldPath, "to", newPath, "folders", subtree.size()));
    }
}
