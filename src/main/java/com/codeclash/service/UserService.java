package com.codeclash.service;

import com.codeclash.dto.ChangePasswordRequest;
import com.codeclash.dto.DashboardDto;
import com.codeclash.entity.LeetcodeProfile;
import com.codeclash.entity.User;
import com.codeclash.repository.LeetcodeProfileRepository;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final LeetcodeProfileRepository leetcodeProfileRepository;
    private final PasswordEncoder passwordEncoder;

    public void changePassword(String username, ChangePasswordRequest request) {
        User user = getUserByUsername(username);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public User getUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public DashboardDto getDashboard(String username) {
        User user = getUserByUsername(username);
        List<User> ranked = userRepository.findAllByRoleNotOrderByCoinsDesc("ADMIN");
        long rank = 1;
        for (User u : ranked) {
            if (u.getId().equals(user.getId()))
                break;
            rank++;
        }

        Optional<LeetcodeProfile> profile = leetcodeProfileRepository.findByUserId(user.getId());
        int solvedCount = profile.map(p -> 
            (p.getEasySolved() != null ? p.getEasySolved() : 0) +
            (p.getMediumSolved() != null ? p.getMediumSolved() : 0) +
            (p.getHardSolved() != null ? p.getHardSolved() : 0)
        ).orElse(user.getProblemsSolved());

        return DashboardDto.builder()
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .totalCoins(user.getCoins())
                .problemsSolved(solvedCount)
                .userRank(rank)
                .totalUsers((long) ranked.size())
                .build();
    }
}
