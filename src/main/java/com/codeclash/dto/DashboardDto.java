package com.codeclash.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardDto {
    private String username;
    private String displayName;
    private Integer totalCoins;
    private Integer problemsSolved;
    private Long userRank;
    private Long totalUsers;
    private String checkInTimer;

    @Builder.Default
    private Long totalBattles = 0L;
    @Builder.Default
    private Long wins = 0L;
    @Builder.Default
    private Long losses = 0L;
    @Builder.Default
    private Integer winRate = 0;
    @Builder.Default
    private Integer totalXp = 0;
    @Builder.Default
    private Integer level = 1;
    @Builder.Default
    private Integer currentLevelXp = 0;
    @Builder.Default
    private Integer nextLevelXp = 250;
    @Builder.Default
    private Integer xpProgressPercent = 0;
    @Builder.Default
    private Integer friendsCount = 0;

    @Builder.Default
    private java.util.List<RecentBattleDto> recentBattles = java.util.Collections.emptyList();
}
