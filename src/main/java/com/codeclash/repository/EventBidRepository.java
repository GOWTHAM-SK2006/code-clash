package com.codeclash.repository;

import com.codeclash.entity.EventBid;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EventBidRepository extends JpaRepository<EventBid, Long> {
    Optional<EventBid> findByEventIdAndUserId(String eventId, Long userId);

    List<EventBid> findAllByEventIdOrderByAmountDescUpdatedAtAsc(String eventId);

    void deleteAllByEventId(String eventId);

    void deleteByUserId(Long userId);
}
