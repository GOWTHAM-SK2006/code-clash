package com.codeclash.service;

import com.codeclash.dto.FriendOverviewDto;
import com.codeclash.dto.FriendRequestDto;
import com.codeclash.dto.FriendUserDto;
import com.codeclash.entity.FriendRequest;
import com.codeclash.entity.FriendRequestStatus;
import com.codeclash.entity.User;
import com.codeclash.repository.FriendRequestRepository;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FriendService {

    private static final int MAX_FRIENDS = 3;

    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;

    public FriendOverviewDto getOverview(String username) {
        User currentUser = getUserByUsername(username);
        List<User> allUsers = userRepository.findAll().stream()
                .filter(user -> !Objects.equals(user.getId(), currentUser.getId()))
                .sorted(Comparator.comparing(this::displayNameLower, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();

        List<FriendRequest> relationships = friendRequestRepository.findAllForUser(currentUser);
        Map<Long, FriendUserDto> relationByUserId = buildRelationMap(currentUser, relationships);

        List<FriendUserDto> allUsersDto = allUsers.stream()
                .map(user -> relationByUserId.getOrDefault(user.getId(),
                        FriendUserDto.builder()
                                .userId(user.getId())
                                .username(user.getUsername())
                                .displayName(resolveDisplayName(user))
                                .relation("NONE")
                                .requestId(null)
                                .build()))
                .toList();

        List<FriendUserDto> friends = allUsersDto.stream()
                .filter(user -> "FRIEND".equals(user.getRelation()))
                .toList();

        List<FriendRequestDto> sentRequests = friendRequestRepository
                .findByRequesterAndStatusOrderByCreatedAtDesc(currentUser, FriendRequestStatus.PENDING)
                .stream()
                .map(this::toRequestDto)
                .toList();

        List<FriendRequestDto> receivedRequests = friendRequestRepository
                .findByReceiverAndStatusOrderByCreatedAtDesc(currentUser, FriendRequestStatus.PENDING)
                .stream()
                .map(this::toRequestDto)
                .toList();

        return FriendOverviewDto.builder()
                .allUsers(allUsersDto)
                .friends(friends)
                .sentRequests(sentRequests)
                .receivedRequests(receivedRequests)
                .build();
    }

    public FriendRequestDto sendRequest(String username, Long targetUserId) {
        User sender = getUserByUsername(username);
        User receiver = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        if (Objects.equals(sender.getId(), receiver.getId())) {
            throw new RuntimeException("You cannot send a friend request to yourself");
        }

        if (hasReachedFriendLimit(sender)) {
            throw new RuntimeException("Maximum friends limit reached (3)");
        }

        if (hasReachedFriendLimit(receiver)) {
            throw new RuntimeException("This user already reached the maximum friends limit (3)");
        }

        Optional<FriendRequest> existing = friendRequestRepository.findRelationshipBetweenUsers(sender.getId(), receiver.getId());
        if (existing.isPresent()) {
            FriendRequest relationship = existing.get();
            if (relationship.getStatus() == FriendRequestStatus.ACCEPTED) {
                throw new RuntimeException("You are already friends");
            }
            if (Objects.equals(relationship.getRequester().getId(), sender.getId())) {
                throw new RuntimeException("Friend request already sent");
            }
            throw new RuntimeException("This user has already sent you a request");
        }

        FriendRequest request = FriendRequest.builder()
                .requester(sender)
                .receiver(receiver)
                .status(FriendRequestStatus.PENDING)
                .build();

        return toRequestDto(friendRequestRepository.save(request));
    }

    public FriendRequestDto acceptRequest(String username, Long requestId) {
        User currentUser = getUserByUsername(username);
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        User requester = request.getRequester();

        if (!Objects.equals(request.getReceiver().getId(), currentUser.getId())) {
            throw new RuntimeException("You are not allowed to accept this request");
        }

        if (request.getStatus() != FriendRequestStatus.PENDING) {
            throw new RuntimeException("Friend request is already processed");
        }

        if (hasReachedFriendLimit(currentUser)) {
            throw new RuntimeException("Maximum friends limit reached (3)");
        }

        if (hasReachedFriendLimit(requester)) {
            throw new RuntimeException("Requester already reached the maximum friends limit (3)");
        }

        request.setStatus(FriendRequestStatus.ACCEPTED);
        return toRequestDto(friendRequestRepository.save(request));
    }

    public List<FriendRequestDto> getNotifications(String username) {
        User currentUser = getUserByUsername(username);
        return friendRequestRepository.findByReceiverAndStatusOrderByCreatedAtDesc(currentUser, FriendRequestStatus.PENDING)
                .stream()
                .map(this::toRequestDto)
                .collect(Collectors.toList());
    }

    private User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private Map<Long, FriendUserDto> buildRelationMap(User currentUser, List<FriendRequest> relationships) {
        Map<Long, FriendUserDto> relationMap = new HashMap<>();

        for (FriendRequest relationship : relationships) {
            User other = Objects.equals(relationship.getRequester().getId(), currentUser.getId())
                    ? relationship.getReceiver()
                    : relationship.getRequester();

            String relation;
            Long requestId = null;

            if (relationship.getStatus() == FriendRequestStatus.ACCEPTED) {
                relation = "FRIEND";
            } else if (Objects.equals(relationship.getRequester().getId(), currentUser.getId())) {
                relation = "SENT";
                requestId = relationship.getId();
            } else {
                relation = "RECEIVED";
                requestId = relationship.getId();
            }

            relationMap.put(other.getId(), FriendUserDto.builder()
                    .userId(other.getId())
                    .username(other.getUsername())
                    .displayName(resolveDisplayName(other))
                    .relation(relation)
                    .requestId(requestId)
                    .build());
        }

        return relationMap;
    }

    private FriendRequestDto toRequestDto(FriendRequest request) {
        return FriendRequestDto.builder()
                .requestId(request.getId())
                .status(request.getStatus().name())
                .createdAt(request.getCreatedAt())
                .fromUserId(request.getRequester().getId())
                .fromUsername(request.getRequester().getUsername())
                .fromDisplayName(resolveDisplayName(request.getRequester()))
                .toUserId(request.getReceiver().getId())
                .toUsername(request.getReceiver().getUsername())
                .toDisplayName(resolveDisplayName(request.getReceiver()))
                .build();
    }

    private String resolveDisplayName(User user) {
        return (user.getDisplayName() == null || user.getDisplayName().isBlank())
                ? user.getUsername()
                : user.getDisplayName();
    }

    private String displayNameLower(User user) {
        return resolveDisplayName(user).toLowerCase(Locale.ROOT);
    }

    private boolean hasReachedFriendLimit(User user) {
        long friendCount = friendRequestRepository.countByUserAndStatus(user, FriendRequestStatus.ACCEPTED);
        return friendCount >= MAX_FRIENDS;
    }
}
