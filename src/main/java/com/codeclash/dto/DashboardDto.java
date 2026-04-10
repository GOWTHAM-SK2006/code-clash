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
    private Integer level;
    private Integer xp;
    private Integer nextLevelXp;
    private String checkInTimer;
}
