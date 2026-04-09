package com.codeclash.repository;

import com.codeclash.entity.BattleParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BattleParticipantRepository extends JpaRepository<BattleParticipant, Long> {
    List<BattleParticipant> findByBattleId(Long battleId);

    long countByBattleId(Long battleId);

    long countByUserId(Long userId);

    java.util.Optional<BattleParticipant> findTopByUserIdOrderByBattleIdDesc(Long userId);

    List<BattleParticipant> findByUserId(Long userId);

    void deleteByUserId(Long userId);
}
