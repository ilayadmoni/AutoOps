package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.machine.entity.MachineFolder;
import com.autoops.machine.repository.MachineFolderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MachineFolderService {
    public record Folder(Long id, String name, String path, Long parentId) {}
    private final MachineFolderRepository repo;

    public MachineFolderService(MachineFolderRepository repo) { this.repo = repo; }

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
        return repo.findByPath(path).map(MachineFolder::getId).orElseGet(() -> {
            int split = path.lastIndexOf('/');
            Long parent = split < 0 ? null : ensurePath(path.substring(0, split));
            String name = split < 0 ? path : path.substring(split + 1);
            return repo.save(new MachineFolder(name, path, parent)).getId();
        });
    }
}
