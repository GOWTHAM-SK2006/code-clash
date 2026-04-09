package com.codeclash.controller;

import com.codeclash.dto.ChangePasswordRequest;
import com.codeclash.entity.User;
import com.codeclash.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(userService.getUserByUsername(user.getUsername()));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(userService.getDashboard(user.getUsername()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(Authentication auth, @RequestBody ChangePasswordRequest request) {
        try {
            User user = (User) auth.getPrincipal();
            userService.changePassword(user.getUsername(), request);
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/check-in")
    public ResponseEntity<?> checkIn(Authentication auth) {
        try {
            User user = (User) auth.getPrincipal();
            userService.checkIn(user.getUsername());
            return ResponseEntity.ok(Map.of("message", "Check-in successful! +30 Coins"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
