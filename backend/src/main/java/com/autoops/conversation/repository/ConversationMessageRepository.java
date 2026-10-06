package com.autoops.conversation.repository;

import com.autoops.conversation.entity.ConversationMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {
    List<ConversationMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    List<ConversationMessage> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    @Modifying
    @Query("delete from ConversationMessage m where m.conversationId = :id")
    void deleteByConversationId(@Param("id") Long conversationId);
}
