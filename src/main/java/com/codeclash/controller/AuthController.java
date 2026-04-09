package com.codeclash.controller;

import com.codeclash.dto.*;
import com.codeclash.service.AdminPanelService;
import com.codeclash.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AdminPanelService adminPanelService;

    @GetMapping("/registration-status")
    public Map<String, Object> registrationStatus() {
        Map<String, Object> settings = adminPanelService.getSettings();
        Object platform = settings.get("platform");
        boolean allowed = true;
        if (platform instanceof Map<?, ?> p) {
            Object val = p.get("allowRegistrations");
            if (val instanceof Boolean b)
                allowed = b;
        }
        return Map.of("allowed", allowed);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            Map<String, Object> settings = adminPanelService.getSettings();
            Object platform = settings.get("platform");
            if (platform instanceof Map<?, ?> p) {
                Object val = p.get("allowRegistrations");
                if (val instanceof Boolean b && !b) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "Registrations are currently closed by the administrator."));
                }
            }
            return ResponseEntity.ok(authService.register(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
