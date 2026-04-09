package com.codeclash.repository;

import com.codeclash.entity.BattleQueue;
import com.codeclash.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BattleQueueRepository extends JpaRepository<BattleQueue, Long> {
    Optional<BattleQueue> findFirstByOrderByCreatedAtAsc();

    Optional<BattleQueue> findFirstByDifficultyIgnoreCaseOrderByCreatedAtAsc(String difficulty);

    Optional<BattleQueue> findByUser(User user);

    @Transactional
    @Modifying
    void deleteByUser(User user);
}
