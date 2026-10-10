package com.autoops.files.repository;

import com.autoops.files.entity.StoredFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface StoredFileRepository extends JpaRepository<StoredFile, Long> {
    List<StoredFile> findByDeletedAtIsNullOrderByIdDesc();

    Optional<StoredFile> findByIdAndDeletedAtIsNull(Long id);

    Optional<StoredFile> findFirstByOriginalFilenameAndChecksumAndDeletedAtIsNullOrderByIdAsc(String originalFilename, String checksum);

    /** Orphans past retention that no workflow step references at all (not even deleted workflows' history). */
    @Query(value = """
            SELECT f.* FROM stored_files f
            WHERE f.orphaned_at IS NOT NULL AND f.orphaned_at < :cutoff
              AND NOT EXISTS (SELECT 1 FROM file_transfer_steps s WHERE s.stored_file_id = f.id)
            """, nativeQuery = true)
    List<StoredFile> findPurgeableOrphans(@Param("cutoff") Instant cutoff);
}
