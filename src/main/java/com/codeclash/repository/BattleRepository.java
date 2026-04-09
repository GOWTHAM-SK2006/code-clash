package com.codeclash.repository;

import com.codeclash.entity.Battle;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BattleRepository extends JpaRepository<Battle, Long> {
    List<Battle> findByStatus(String status);

    long countByWinnerId(Long winnerId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE Battle b SET b.winnerId = NULL WHERE b.winnerId = :userId")
    void clearWinnerId(@org.springframework.data.repository.query.Param("userId") Long userId);

    java.util.Optional<Battle> findFirstByModeAndStatusAndProblemDifficultyIgnoreCaseAndIsCustomFalseOrderByStartedAtAsc(String mode, String status, String difficulty);
}
