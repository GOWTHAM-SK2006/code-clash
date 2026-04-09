package com.codeclash.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendUserDto {
    private Long userId;
    private String username;
    private String displayName;
    private String relation;
    private Long requestId;
}
