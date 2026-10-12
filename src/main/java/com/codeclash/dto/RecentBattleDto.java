package com.codeclash.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecentBattleDto {
    private Long id;
    private String mode;
    private String problemTitle;
    private String opponentName;
    private String result; // "WON", "LOST", "DRAW", "CANCELLED", "IN_PROGRESS"
    private Integer score;
    private Integer xpEarned;
    private LocalDateTime date;
}
