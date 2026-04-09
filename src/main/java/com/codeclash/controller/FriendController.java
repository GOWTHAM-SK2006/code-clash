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

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(Authentication auth) {
        User current = (User) auth.getPrincipal();
        return ResponseEntity.ok(friendService.getNotifications(current.getUsername()));
    }
}
