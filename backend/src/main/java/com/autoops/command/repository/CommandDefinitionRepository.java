package com.autoops.command.repository;

import com.autoops.command.entity.CommandDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommandDefinitionRepository extends JpaRepository<CommandDefinition, Long> {
    List<CommandDefinition> findByStatusOrderByNameAsc(String status);

    List<CommandDefinition> findAllByOrderByNameAsc();

    @Query("select c from CommandDefinition c where c.status = 'APPROVED' or c.createdBy = :userId order by c.name asc")
    List<CommandDefinition> findVisibleTo(@Param("userId") Long userId);

    boolean existsByNormalizedTemplate(String normalizedTemplate);

    boolean existsBySource(String source);

    @Query("select c.id from CommandDefinition c")
    List<Long> findAllIds();

    /** Nearest approved commands by cosine distance; returns (id, distance) pairs. */
    @Query(value = "SELECT id, (embedding <=> CAST(:embedding AS vector)) AS distance FROM command_definitions "
            + "WHERE status = 'APPROVED' AND embedding IS NOT NULL ORDER BY embedding <=> CAST(:embedding AS vector) LIMIT :limit",
            nativeQuery = true)
    List<Object[]> nearest(@Param("embedding") String embedding, @Param("limit") int limit);
}
