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
import com.codeclash.dto.RecentBattleDto;
import com.codeclash.repository.BattleParticipantRepository;
import com.codeclash.repository.BattleRepository;
import com.codeclash.repository.FriendRequestRepository;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {
    private final CoinService coinService;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final BattleRepository battleRepository;
    private final BattleParticipantRepository battleParticipantRepository;
    private final FriendRequestRepository friendRequestRepository;

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

    @Transactional(readOnly = true)
    public DashboardDto getDashboard(String username) {
        User user = getUserByUsername(username);
        List<User> ranked = userRepository.findAllByRoleNotOrderByCoinsDesc("ADMIN");
        long rank = 1;
        for (User u : ranked) {
            if (u.getId().equals(user.getId()))
                break;
            rank++;
        }

        int solvedCount = user.getProblemsSolved() != null ? user.getProblemsSolved() : 0;
        int coins = user.getCoins() != null ? user.getCoins() : 0;

        List<com.codeclash.entity.BattleParticipant> participations = battleParticipantRepository.findByUserId(user.getId());
        long totalBattles = participations.size();
        long wins = 0;
        long losses = 0;
        long draws = 0;

        for (com.codeclash.entity.BattleParticipant bp : participations) {
            com.codeclash.entity.Battle b = bp.getBattle();
            if (b == null || "CANCELLED".equalsIgnoreCase(b.getStatus())) {
                continue;
            }

            boolean isWinner = user.getId().equals(b.getWinnerId()) ||
                    (bp.getTeamId() != null && bp.getTeamId().equals(b.getWinningTeamId()));

            if (isWinner) {
                wins++;
            } else if (b.getWinnerId() == null && b.getWinningTeamId() == null &&
                    ("DRAW".equalsIgnoreCase(b.getStatus()) || "COMPLETED".equalsIgnoreCase(b.getStatus()))) {
                draws++;
            } else if ("COMPLETED".equalsIgnoreCase(b.getStatus()) || b.getWinnerId() != null || b.getWinningTeamId() != null) {
                losses++;
            }
        }

        long completedMatches = wins + losses + draws;
        int winRate = completedMatches > 0 ? (int) Math.round(((double) wins / completedMatches) * 100) : 0;

        int totalXp = (solvedCount * 100) + (int)(wins * 50) + (int)(draws * 20) + (int)(losses * 10);
        int level = Math.max(1, (totalXp / 250) + 1);
        int currentLevelXp = totalXp % 250;
        int nextLevelXp = 250;
        int xpProgressPercent = (int) Math.min(100, Math.round((currentLevelXp / 250.0) * 100));

        int friendsCount = 0;
        try {
            friendsCount = (int) friendRequestRepository.findAllForUser(user).stream()
                    .filter(r -> com.codeclash.entity.FriendRequestStatus.ACCEPTED.equals(r.getStatus()))
                    .count();
        } catch (Exception ignored) {}

        List<RecentBattleDto> recentBattles = participations.stream()
                .filter(bp -> bp.getBattle() != null)
                .sorted((p1, p2) -> {
                    LocalDateTime d1 = p1.getBattle().getStartedAt() != null ? p1.getBattle().getStartedAt() : LocalDateTime.MIN;
                    LocalDateTime d2 = p2.getBattle().getStartedAt() != null ? p2.getBattle().getStartedAt() : LocalDateTime.MIN;
                    return d2.compareTo(d1);
                })
                .limit(5)
                .map(bp -> buildRecentBattleDto(user, bp))
                .collect(java.util.stream.Collectors.toList());

        return DashboardDto.builder()
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .totalCoins(coins)
                .problemsSolved(solvedCount)
                .userRank(rank)
                .totalUsers((long) ranked.size())
                .checkInTimer(calculateCheckInTimer(user))
                .totalBattles(totalBattles)
                .wins(wins)
                .losses(losses)
                .winRate(winRate)
                .totalXp(totalXp)
                .level(level)
                .currentLevelXp(currentLevelXp)
                .nextLevelXp(nextLevelXp)
                .xpProgressPercent(xpProgressPercent)
                .friendsCount(friendsCount)
                .recentBattles(recentBattles)
                .build();
    }

    private RecentBattleDto buildRecentBattleDto(User currentUser, com.codeclash.entity.BattleParticipant bp) {
        com.codeclash.entity.Battle b = bp.getBattle();
        boolean isWinner = currentUser.getId().equals(b.getWinnerId()) ||
                (bp.getTeamId() != null && bp.getTeamId().equals(b.getWinningTeamId()));

        String result;
        if ("CANCELLED".equalsIgnoreCase(b.getStatus())) {
            result = "CANCELLED";
        } else if (isWinner) {
            result = "WON";
        } else if (b.getWinnerId() == null && b.getWinningTeamId() == null &&
                ("DRAW".equalsIgnoreCase(b.getStatus()) || "COMPLETED".equalsIgnoreCase(b.getStatus()))) {
            result = "DRAW";
        } else if ("WAITING".equalsIgnoreCase(b.getStatus()) || "ACTIVE".equalsIgnoreCase(b.getStatus())) {
            result = "IN_PROGRESS";
        } else {
            result = "LOST";
        }

        String opponentName = "Awaiting Match";
        try {
            List<com.codeclash.entity.BattleParticipant> allInBattle = battleParticipantRepository.findByBattleId(b.getId());
            String opponents = allInBattle.stream()
                    .filter(p -> p.getUser() != null && !p.getUser().getId().equals(currentUser.getId()))
                    .map(p -> (p.getUser().getDisplayName() != null && !p.getUser().getDisplayName().isBlank())
                            ? p.getUser().getDisplayName()
                            : p.getUser().getUsername())
                    .collect(java.util.stream.Collectors.joining(", "));
            if (!opponents.isBlank()) {
                opponentName = opponents;
            }
        } catch (Exception ignored) {}

        int score = b.getProblem() != null && b.getProblem().getPoints() != null ? b.getProblem().getPoints() : 10;
        int xpEarned = switch (result) {
            case "WON" -> 50;
            case "DRAW" -> 20;
            case "LOST" -> 10;
            default -> 0;
        };

        LocalDateTime date = b.getStartedAt() != null ? b.getStartedAt() :
                (b.getEndedAt() != null ? b.getEndedAt() : LocalDateTime.now());

        return RecentBattleDto.builder()
                .id(b.getId())
                .mode(b.getMode() != null ? b.getMode() : "1v1")
                .problemTitle(b.getProblem() != null ? b.getProblem().getTitle() : "Duel Arena Problem")
                .opponentName(opponentName)
                .result(result)
                .score(score)
                .xpEarned(xpEarned)
                .date(date)
                .build();
    }

    private String calculateCheckInTimer(User user) {
        if (user.getLastCheckIn() == null) return "READY";
        
        LocalDateTime now = LocalDateTime.now();
        Duration duration = Duration.between(user.getLastCheckIn(), now);
        
        if (duration.toHours() >= 12) return "READY";
        
        long secondsLeft = (12 * 3600) - duration.getSeconds();
        long hours = secondsLeft / 3600;
        long mins = (secondsLeft % 3600) / 60;
        long secs = secondsLeft % 60;
        
        return String.format("%02d:%02d:%02d", hours, mins, secs);
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
