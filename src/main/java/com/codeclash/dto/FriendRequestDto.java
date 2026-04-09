package com.codeclash.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendRequestDto {
    private Long requestId;
    private String status;
    private LocalDateTime createdAt;
    private Long fromUserId;
    private String fromUsername;
    private String fromDisplayName;
    private Long toUserId;
    private String toUsername;
    private String toDisplayName;
}
