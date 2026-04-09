package com.codeclash.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaderboardDto {
    private Long rank;
    private String username;
    private String displayName;
    private Integer totalCoins;
    private Integer problemsSolved;
    @Builder.Default
    private Long battleWins = 0L;
    @Builder.Default
    private Long battlesAttended = 0L;
    private String section;
    private String department;
}
