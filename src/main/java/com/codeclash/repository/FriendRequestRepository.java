package com.codeclash.repository;

import com.codeclash.entity.FriendRequest;
import com.codeclash.entity.FriendRequestStatus;
import com.codeclash.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    @Query("SELECT fr FROM FriendRequest fr WHERE ((fr.requester.id = :userA AND fr.receiver.id = :userB) OR (fr.requester.id = :userB AND fr.receiver.id = :userA))")
    Optional<FriendRequest> findRelationshipBetweenUsers(@Param("userA") Long userA, @Param("userB") Long userB);

    @Query("SELECT fr FROM FriendRequest fr WHERE fr.requester = :user OR fr.receiver = :user ORDER BY fr.updatedAt DESC")
    List<FriendRequest> findAllForUser(@Param("user") User user);

    List<FriendRequest> findByRequesterAndStatusOrderByCreatedAtDesc(User requester, FriendRequestStatus status);

    List<FriendRequest> findByReceiverAndStatusOrderByCreatedAtDesc(User receiver, FriendRequestStatus status);

    @Query("SELECT COUNT(fr) FROM FriendRequest fr WHERE (fr.requester = :user OR fr.receiver = :user) AND fr.status = :status")
    long countByUserAndStatus(@Param("user") User user, @Param("status") FriendRequestStatus status);

    void deleteByRequesterIdOrReceiverId(Long requesterId, Long receiverId);
}
