package com.codeclash.service;

import com.codeclash.dto.*;
import com.codeclash.entity.User;
import com.codeclash.repository.UserRepository;
import com.codeclash.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LeetcodeSyncService leetcodeSyncService;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getDisplayName() != null ? request.getDisplayName() : request.getUsername())
                .leetcodeUsername(request.getLeetcodeUsername())
                .section(request.getSection() != null ? request.getSection().toUpperCase() : null)
                .build();

        userRepository.save(user);

        // Auto-connect LeetCode profile if username was provided
        if (request.getLeetcodeUsername() != null && !request.getLeetcodeUsername().trim().isEmpty()) {
            try {
                leetcodeSyncService.connectProfile(user.getUsername(), request.getLeetcodeUsername().trim());
            } catch (Exception e) {
                // Don't fail registration if LeetCode connect fails
            }
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .userId(user.getId())
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        // Auto-connect/sync LeetCode if username exists
        if (user.getLeetcodeUsername() != null && !user.getLeetcodeUsername().trim().isEmpty()) {
            try {
                Optional<com.codeclash.entity.LeetcodeProfile> profile = leetcodeSyncService.getProfile(user.getUsername());
                if (profile.isEmpty()) {
                    leetcodeSyncService.connectProfile(user.getUsername(), user.getLeetcodeUsername().trim());
                } else if (profile.get().getLastSyncedAt() == null) {
                    // Force a sync if it has never been synced
                    leetcodeSyncService.syncProfile(user.getUsername());
                }
            } catch (Exception e) {
                // Ignore sync errors during login to avoid blocking access
            }
        }

        String token = jwtUtil.generateToken(user.getUsername());
        return AuthResponse.builder()
                .token(token)
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .userId(user.getId())
                .build();
    }
}
