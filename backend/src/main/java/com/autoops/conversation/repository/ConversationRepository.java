package com.autoops.conversation.repository;

import com.autoops.conversation.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findTop50ByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<Conversation> findByIdAndUserId(Long id, Long userId);
}
