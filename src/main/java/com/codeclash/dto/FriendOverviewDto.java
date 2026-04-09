package com.codeclash.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendOverviewDto {
    private List<FriendUserDto> allUsers;
    private List<FriendUserDto> friends;
    private List<FriendRequestDto> sentRequests;
    private List<FriendRequestDto> receivedRequests;
}
