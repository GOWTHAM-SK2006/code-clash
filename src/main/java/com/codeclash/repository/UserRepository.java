package com.codeclash.repository;

import com.codeclash.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByLeetcodeUsername(String leetcodeUsername);

    List<User> findAllByOrderByCoinsDesc();

    List<User> findAllByRoleNot(String role);
}
