package com.codeclash.controller;

import com.codeclash.entity.User;
import com.codeclash.service.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;

    @GetMapping("/overview")
    public ResponseEntity<?> getOverview(Authentication auth) {
        User current = (User) auth.getPrincipal();
        return ResponseEntity.ok(friendService.getOverview(current.getUsername()));
    }

    @PostMapping("/requests/{targetUserId}")
    public ResponseEntity<?> sendFriendRequest(Authentication auth, @PathVariable Long targetUserId) {
        User current = (User) auth.getPrincipal();
        return ResponseEntity.ok(friendService.sendRequest(current.getUsername(), targetUserId));
    }

    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<?> acceptFriendRequest(Authentication auth, @PathVariable Long requestId) {
        User current = (User) auth.getPrincipal();
        return ResponseEntity.ok(friendService.acceptRequest(current.getUsername(), requestId));
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<?> rejectFriendRequest(Authentication auth, @PathVariable Long requestId) {
        User current = (User) auth.getPrincipal();
        friendService.rejectRequest(current.getUsername(), requestId);
        return ResponseEntity.ok(java.util.Map.of("message", "Friend request rejected"));
    }

    @PostMapping("/requests/{requestId}/cancel")
    public ResponseEntity<?> cancelFriendRequest(Authentication auth, @PathVariable Long requestId) {
        User current = (User) auth.getPrincipal();
        friendService.cancelRequest(current.getUsername(), requestId);
        return ResponseEntity.ok(java.util.Map.of("message", "Friend request cancelled"));
    }

    @DeleteMapping("/{targetUserId}")
    public ResponseEntity<?> removeFriend(Authentication auth, @PathVariable Long targetUserId) {
        User current = (User) auth.getPrincipal();
        friendService.removeFriend(current.getUsername(), targetUserId);
        return ResponseEntity.ok(java.util.Map.of("message", "Friend removed successfully"));
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(Authentication auth) {
        User current = (User) auth.getPrincipal();
        return ResponseEntity.ok(friendService.getNotifications(current.getUsername()));
    }
}
