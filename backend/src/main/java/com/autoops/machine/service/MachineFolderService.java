package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.audit.service.AuditService;
import com.autoops.machine.entity.MachineFolder;
import com.autoops.machine.repository.MachineFolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class MachineFolderService {
    public record Folder(Long id, String name, String path, Long parentId) {}
    private final MachineFolderRepository repo;
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public MachineFolderService(MachineFolderRepository repo, JdbcTemplate jdbc, AuditService audit) {
        this.repo = repo; this.jdbc = jdbc; this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<Folder> list() {
        return repo.findAllByOrderByPathAsc().stream()
                .map(f -> new Folder(f.getId(), f.getName(), f.getPath(), f.getParentId())).toList();
    }

    public void requireExists(Long id) {
        if (id != null && !repo.existsById(id)) throw ApiException.notFound("Machine folder");
    }

    /** Called inside the import row's transaction and import lock. Paths are logical, never disk paths. */
    public Long ensurePath(String path) {
        if (path.isEmpty()) return null;
        if (path.length() > 1000) throw ApiException.validation("Folder path exceeds 1000 characters");
        return repo.findByPath(path).map(MachineFolder::getId).orElseGet(() -> {
            int split = path.lastIndexOf('/');
            Long parent = split < 0 ? null : ensurePath(path.substring(0, split));
            String name = split < 0 ? path : path.substring(split + 1);
            return repo.save(new MachineFolder(name, path, parent)).getId();
        });
    }

    public Long ensureRelativePath(String path, Long baseId) {
        if (baseId == null) return ensurePath(path);
        MachineFolder base = repo.findById(baseId).orElseThrow(() -> ApiException.notFound("Machine folder"));
        return path.isEmpty() ? baseId : ensurePath(base.getPath() + "/" + path);
    }

    /** Removes a folder subtree while keeping its machines in the deleted folder's parent. */
    @Transactional
    public void delete(Long userId, Long id) {
        MachineFolderLock.acquire(jdbc);
        MachineFolder root = repo.findById(id).orElseThrow(() -> ApiException.notFound("Machine folder"));
        List<MachineFolder> subtree = repo.findAllByOrderByPathAsc().stream()
                .filter(f -> f.getPath().equals(root.getPath()) || f.getPath().startsWith(root.getPath() + "/"))
                .sorted(Comparator.comparingInt((MachineFolder f) -> f.getPath().length()).reversed()).toList();
        int moved = 0;
        for (MachineFolder folder : subtree) {
            moved += jdbc.update("UPDATE machines SET folder_id = ? WHERE folder_id = ?", root.getParentId(), folder.getId());
            jdbc.update("DELETE FROM user_favorites WHERE collection = 'machine-folders' AND item_id = ?", folder.getId());
            repo.delete(folder);
            repo.flush();
        }
        audit.record(userId, "MACHINE_FOLDER_DELETED", "MACHINE_FOLDER", id,
                Map.of("path", root.getPath(), "folders", subtree.size(), "machinesMoved", moved));
    }
}
