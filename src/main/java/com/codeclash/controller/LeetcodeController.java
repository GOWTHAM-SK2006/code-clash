package com.codeclash.controller;

import com.codeclash.entity.User;
import com.codeclash.service.LeetcodeSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/leetcode")
@RequiredArgsConstructor
public class LeetcodeController {

    private final LeetcodeSyncService leetcodeSyncService;

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody Map<String, String> request, Authentication auth) {
        String leetcodeUsername = request.get("username");
        if (leetcodeUsername == null || leetcodeUsername.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }
        try {
            User user = (User) auth.getPrincipal();
            return ResponseEntity.ok(leetcodeSyncService.connectProfile(user.getUsername(), leetcodeUsername));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/sync")
    public ResponseEntity<?> sync(Authentication auth) {
        try {
            User user = (User) auth.getPrincipal();
            return ResponseEntity.ok(leetcodeSyncService.syncProfile(user.getUsername()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return leetcodeSyncService.getProfile(user.getUsername())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
