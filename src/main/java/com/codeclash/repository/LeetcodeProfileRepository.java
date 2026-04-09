package com.codeclash.repository;

import com.codeclash.entity.LeetcodeProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface LeetcodeProfileRepository extends JpaRepository<LeetcodeProfile, Long> {
    Optional<LeetcodeProfile> findByUserId(Long userId);

    Optional<LeetcodeProfile> findByLeetcodeUsername(String leetcodeUsername);

    void deleteByUserId(Long userId);
}
