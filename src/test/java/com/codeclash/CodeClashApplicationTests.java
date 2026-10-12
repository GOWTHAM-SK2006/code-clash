package com.codeclash;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class CodeClashApplicationTests {

    @org.springframework.beans.factory.annotation.Autowired
    private com.codeclash.service.FriendService friendService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.codeclash.repository.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private com.codeclash.repository.FriendRequestRepository friendRequestRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private com.codeclash.service.CoinService coinService;

    @Test
    void contextLoads() {
        // Verifies complete Spring Boot context, JPA repositories, and beans initialize successfully
    }

    @Test
    void testFriendOverviewWithRequests() {
        com.codeclash.entity.User u1 = userRepository.save(com.codeclash.entity.User.builder()
                .username("test_u1")
                .email("u1@test.com")
                .password("pass123")
                .coins(0)
                .build());
        com.codeclash.entity.User u2 = userRepository.save(com.codeclash.entity.User.builder()
                .username("test_u2")
                .email("u2@test.com")
                .password("pass123")
                .coins(0)
                .build());

        com.codeclash.entity.FriendRequest req = friendRequestRepository.save(com.codeclash.entity.FriendRequest.builder()
                .requester(u1)
                .receiver(u2)
                .status(com.codeclash.entity.FriendRequestStatus.PENDING)
                .build());

        com.codeclash.dto.FriendOverviewDto overview = friendService.getOverview("test_u1");
        org.junit.jupiter.api.Assertions.assertNotNull(overview);
        org.junit.jupiter.api.Assertions.assertEquals(1, overview.getSentRequests().size());
        org.junit.jupiter.api.Assertions.assertEquals(0, overview.getFriends().size());
    }

    @Test
    void testFriendOverviewEmptyState() {
        com.codeclash.entity.User solo = userRepository.save(com.codeclash.entity.User.builder()
                .username("solo_user")
                .email("solo@test.com")
                .password("pass123")
                .coins(100)
                .build());

        com.codeclash.dto.FriendOverviewDto overview = friendService.getOverview("solo_user");
        org.junit.jupiter.api.Assertions.assertNotNull(overview);
        org.junit.jupiter.api.Assertions.assertNotNull(overview.getFriends());
        org.junit.jupiter.api.Assertions.assertNotNull(overview.getReceivedRequests());
        org.junit.jupiter.api.Assertions.assertNotNull(overview.getSentRequests());
        org.junit.jupiter.api.Assertions.assertEquals(0, overview.getFriends().size());
        org.junit.jupiter.api.Assertions.assertEquals(0, overview.getReceivedRequests().size());
        org.junit.jupiter.api.Assertions.assertEquals(0, overview.getSentRequests().size());
    }

    @Test
    void testAcceptAndRemoveFriend() {
        com.codeclash.entity.User alice = userRepository.save(com.codeclash.entity.User.builder()
                .username("alice")
                .email("alice@test.com")
                .password("pass123")
                .coins(50)
                .build());
        com.codeclash.entity.User bob = userRepository.save(com.codeclash.entity.User.builder()
                .username("bob")
                .email("bob@test.com")
                .password("pass123")
                .coins(50)
                .build());

        com.codeclash.dto.FriendRequestDto sent = friendService.sendRequest("alice", bob.getId());
        org.junit.jupiter.api.Assertions.assertNotNull(sent);

        // Bob accepts
        com.codeclash.dto.FriendRequestDto accepted = friendService.acceptRequest("bob", sent.getRequestId());
        org.junit.jupiter.api.Assertions.assertEquals("ACCEPTED", accepted.getStatus());

        // Verify overview for both
        com.codeclash.dto.FriendOverviewDto aliceOverview = friendService.getOverview("alice");
        org.junit.jupiter.api.Assertions.assertEquals(1, aliceOverview.getFriends().size());

        com.codeclash.dto.FriendOverviewDto bobOverview = friendService.getOverview("bob");
        org.junit.jupiter.api.Assertions.assertEquals(1, bobOverview.getFriends().size());

        // Alice removes Bob
        friendService.removeFriend("alice", bob.getId());

        com.codeclash.dto.FriendOverviewDto aliceAfter = friendService.getOverview("alice");
        org.junit.jupiter.api.Assertions.assertEquals(0, aliceAfter.getFriends().size());
    }

    @Test
    void testRejectFriendRequest() {
        com.codeclash.entity.User charlie = userRepository.save(com.codeclash.entity.User.builder()
                .username("charlie")
                .email("charlie@test.com")
                .password("pass123")
                .coins(0)
                .build());
        com.codeclash.entity.User dave = userRepository.save(com.codeclash.entity.User.builder()
                .username("dave")
                .email("dave@test.com")
                .password("pass123")
                .coins(0)
                .build());

        com.codeclash.dto.FriendRequestDto sent = friendService.sendRequest("charlie", dave.getId());
        org.junit.jupiter.api.Assertions.assertNotNull(sent);

        // Dave rejects
        friendService.rejectRequest("dave", sent.getRequestId());

        com.codeclash.dto.FriendOverviewDto daveOverview = friendService.getOverview("dave");
        org.junit.jupiter.api.Assertions.assertEquals(0, daveOverview.getReceivedRequests().size());
    }

    @Test
    void testCancelFriendRequest() {
        com.codeclash.entity.User eve = userRepository.save(com.codeclash.entity.User.builder()
                .username("eve")
                .email("eve@test.com")
                .password("pass123")
                .coins(0)
                .build());
        com.codeclash.entity.User frank = userRepository.save(com.codeclash.entity.User.builder()
                .username("frank")
                .email("frank@test.com")
                .password("pass123")
                .coins(0)
                .build());

        com.codeclash.dto.FriendRequestDto sent = friendService.sendRequest("eve", frank.getId());

        // Eve cancels her own request
        friendService.cancelRequest("eve", sent.getRequestId());

        com.codeclash.dto.FriendOverviewDto eveOverview = friendService.getOverview("eve");
        org.junit.jupiter.api.Assertions.assertEquals(0, eveOverview.getSentRequests().size());
    }

    @Test
    void testDuplicateFriendRequestPrevention() {
        com.codeclash.entity.User user1 = userRepository.save(com.codeclash.entity.User.builder()
                .username("dup1")
                .email("dup1@test.com")
                .password("pass123")
                .coins(0)
                .build());
        com.codeclash.entity.User user2 = userRepository.save(com.codeclash.entity.User.builder()
                .username("dup2")
                .email("dup2@test.com")
                .password("pass123")
                .coins(0)
                .build());

        friendService.sendRequest("dup1", user2.getId());

        // Sending again should throw exception
        org.junit.jupiter.api.Assertions.assertThrows(RuntimeException.class, () -> {
            friendService.sendRequest("dup1", user2.getId());
        });
    }

    @Test
    void testCoinServiceTransactions() throws Exception {
        com.codeclash.entity.User coinUser = userRepository.save(com.codeclash.entity.User.builder()
                .username("coin_user")
                .email("coin@test.com")
                .password("pass123")
                .coins(10)
                .build());

        coinService.awardCoins(coinUser, 40, "Bonus Coins");
        org.junit.jupiter.api.Assertions.assertEquals(50, coinService.getBalance("coin_user"));

        coinService.spendCoins(coinUser, 20, "Spent Coins");
        org.junit.jupiter.api.Assertions.assertEquals(30, coinService.getBalance("coin_user"));

        var history = coinService.getHistory("coin_user");
        org.junit.jupiter.api.Assertions.assertEquals(2, history.size());
        
        // Verify Jackson ignores user field during JSON serialization
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        mapper.findAndRegisterModules();
        String json = mapper.writeValueAsString(history);
        org.junit.jupiter.api.Assertions.assertFalse(json.contains("\"user\":"));
    }
}
