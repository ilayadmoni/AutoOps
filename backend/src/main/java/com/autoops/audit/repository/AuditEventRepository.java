package com.autoops.audit.repository;

import com.autoops.audit.entity.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    @Query("""
            select a from AuditEvent a
            where (:userId is null or a.userId = :userId)
              and (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
            order by a.id desc
            """)
    Page<AuditEvent> search(@Param("userId") Long userId, @Param("action") String action,
                            @Param("entityType") String entityType, Pageable pageable);
}
