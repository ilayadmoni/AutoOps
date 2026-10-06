package com.autoops.execution.repository;

import com.autoops.execution.entity.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {
    List<ApprovalRequest> findByExecutionIdOrderByIdAsc(Long executionId);

    List<ApprovalRequest> findByExecutionIdAndStatus(Long executionId, String status);

    List<ApprovalRequest> findByStatusOrderByIdAsc(String status);

    @Query("select a from ApprovalRequest a, Execution e where a.executionId = e.id and a.status = 'PENDING' and e.startedBy = :userId order by a.id")
    List<ApprovalRequest> findPendingForUser(@Param("userId") Long userId);
}
