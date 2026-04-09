package com.codeclash.repository;

import com.codeclash.entity.BattleInvite;
import com.codeclash.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BattleInviteRepository extends JpaRepository<BattleInvite, Long> {
    List<BattleInvite> findByReceiverAndStatus(User receiver, String status);
    Optional<BattleInvite> findFirstBySenderAndReceiverAndStatusOrderByCreatedAtDesc(User sender, User receiver, String status);
    
    // Cleanup old pending invites
    List<BattleInvite> findByStatusAndCreatedAtBefore(String status, LocalDateTime expiry);
}
