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

    @Query("SELECT fr FROM FriendRequest fr LEFT JOIN FETCH fr.requester LEFT JOIN FETCH fr.receiver WHERE ((fr.requester.id = :userA AND fr.receiver.id = :userB) OR (fr.requester.id = :userB AND fr.receiver.id = :userA))")
    Optional<FriendRequest> findRelationshipBetweenUsers(@Param("userA") Long userA, @Param("userB") Long userB);

    @Query("SELECT fr FROM FriendRequest fr LEFT JOIN FETCH fr.requester LEFT JOIN FETCH fr.receiver WHERE fr.id = :id")
    Optional<FriendRequest> findByIdWithUsers(@Param("id") Long id);

    @Query("SELECT fr FROM FriendRequest fr LEFT JOIN FETCH fr.requester LEFT JOIN FETCH fr.receiver WHERE fr.requester = :user OR fr.receiver = :user ORDER BY fr.updatedAt DESC")
    List<FriendRequest> findAllForUser(@Param("user") User user);

    @Query("SELECT fr FROM FriendRequest fr LEFT JOIN FETCH fr.requester LEFT JOIN FETCH fr.receiver WHERE fr.requester = :requester AND fr.status = :status ORDER BY fr.createdAt DESC")
    List<FriendRequest> findByRequesterAndStatusOrderByCreatedAtDesc(@Param("requester") User requester, @Param("status") FriendRequestStatus status);

    @Query("SELECT fr FROM FriendRequest fr LEFT JOIN FETCH fr.requester LEFT JOIN FETCH fr.receiver WHERE fr.receiver = :receiver AND fr.status = :status ORDER BY fr.createdAt DESC")
    List<FriendRequest> findByReceiverAndStatusOrderByCreatedAtDesc(@Param("receiver") User receiver, @Param("status") FriendRequestStatus status);

    @Query("SELECT COUNT(fr) FROM FriendRequest fr WHERE (fr.requester = :user OR fr.receiver = :user) AND fr.status = :status")
    long countByUserAndStatus(@Param("user") User user, @Param("status") FriendRequestStatus status);

    void deleteByRequesterIdOrReceiverId(Long requesterId, Long receiverId);
}
