package com.codeclash.service;

import com.codeclash.dto.ChangePasswordRequest;
import com.codeclash.dto.DashboardDto;
import com.codeclash.entity.User;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final CoinService coinService;

    private final UserRepository userRepository;
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

        int solvedCount = user.getProblemsSolved();

        return DashboardDto.builder()
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .totalCoins(user.getCoins())
                .problemsSolved(solvedCount)
                .userRank(rank)
                .totalUsers((long) ranked.size())
                .build();
    }

    @Transactional
    public void checkIn(String username) {
        User user = getUserByUsername(username);
        LocalDateTime now = LocalDateTime.now();

        if (user.getLastCheckIn() != null) {
            Duration duration = Duration.between(user.getLastCheckIn(), now);
            if (duration.toHours() < 12) {
                long minutesLeft = 720 - duration.toMinutes();
                long hours = minutesLeft / 60;
                long mins = minutesLeft % 60;
                throw new RuntimeException("Check-in available in " + hours + "h " + mins + "m");
            }
        }

        user.setLastCheckIn(now);
        userRepository.save(user);

        coinService.awardCoins(user, 30, "Daily Check-in Reward");
    }
}
