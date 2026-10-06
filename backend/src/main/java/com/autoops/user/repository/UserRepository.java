package com.autoops.user.repository;

import com.autoops.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    long countByRoleAndStatus(User.Role role, User.Status status);

    long countByRole(User.Role role);

    List<User> findByStatusNotOrderByUsernameAsc(User.Status status);
}
