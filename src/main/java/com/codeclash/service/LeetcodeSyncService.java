package com.codeclash.service;

import com.codeclash.entity.LeetcodeProfile;
import com.codeclash.entity.User;
import com.codeclash.repository.LeetcodeProfileRepository;
import com.codeclash.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LeetcodeSyncService {

    private final LeetcodeProfileRepository leetcodeProfileRepository;
    private final UserRepository userRepository;
    private final CoinService coinService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int COINS_EASY = 5;
    private static final int COINS_MEDIUM = 10;
    private static final int COINS_HARD = 15;

    private static final String LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

    @Transactional
    public LeetcodeProfile connectProfile(String username, String leetcodeUsername) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Check if this LeetCode username is already used by another user
        Optional<LeetcodeProfile> takenProfile = leetcodeProfileRepository.findByLeetcodeUsername(leetcodeUsername);
        if (takenProfile.isPresent() && !takenProfile.get().getUser().getId().equals(user.getId())) {
            throw new RuntimeException("This LeetCode username is already linked to another account");
        }

        Optional<LeetcodeProfile> existing = leetcodeProfileRepository.findByUserId(user.getId());
        LeetcodeProfile profile;

        if (existing.isPresent()) {
            profile = existing.get();
            profile.setLeetcodeUsername(leetcodeUsername);
        } else {
            profile = LeetcodeProfile.builder()
                    .user(user)
                    .leetcodeUsername(leetcodeUsername)
                    .build();
        }

        LeetcodeProfile savedProfile = leetcodeProfileRepository.save(profile);

        // Perform initial sync to get counts
        try {
            syncProfile(username);
        } catch (Exception e) {
            log.warn("Initial sync failed for {}: {}", leetcodeUsername, e.getMessage());
        }

        return savedProfile;
    }

    @Transactional
    public LeetcodeProfile syncProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        LeetcodeProfile profile = leetcodeProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("LeetCode profile not connected"));

        // No sync time limit — users can sync whenever they want

        try {
            log.info("Syncing LeetCode profile for {}", profile.getLeetcodeUsername());

            // Fetch solved counts via GraphQL
            Map<String, Integer> counts = fetchSolvedCounts(profile.getLeetcodeUsername());
            int easy = counts.getOrDefault("Easy", 0);
            int medium = counts.getOrDefault("Medium", 0);
            int hard = counts.getOrDefault("Hard", 0);

            log.info("Fetched counts for {}: Easy={}, Medium={}, Hard={}",
                    profile.getLeetcodeUsername(), easy, medium, hard);

            // Calculate new solved counts
            int newEasy = Math.max(0, easy - (profile.getEasySolved() != null ? profile.getEasySolved() : 0));
            int newMedium = Math.max(0, medium - (profile.getMediumSolved() != null ? profile.getMediumSolved() : 0));
            int newHard = Math.max(0, hard - (profile.getHardSolved() != null ? profile.getHardSolved() : 0));

            int earnedCoins = (newEasy * COINS_EASY) + (newMedium * COINS_MEDIUM) + (newHard * COINS_HARD);

            if (earnedCoins > 0) {
                String reason = String.format("LeetCode Sync: +%d Easy, +%d Medium, +%d Hard", newEasy, newMedium,
                        newHard);
                coinService.awardCoins(user, earnedCoins, reason);
                profile.setTotalCoinsEarned(
                        (profile.getTotalCoinsEarned() != null ? profile.getTotalCoinsEarned() : 0) + earnedCoins);
                log.info("Awarded {} coins to user {} for LeetCode sync", earnedCoins, user.getUsername());
            }

            profile.setEasySolved(easy);
            profile.setMediumSolved(medium);
            profile.setHardSolved(hard);

            // Sync total solved count to User entity
            user.setProblemsSolved(easy + medium + hard);
            userRepository.save(user);

            // Fetch and merge solved titles
            try {
                Set<String> recentTitles = fetchRecentAcTitles(profile.getLeetcodeUsername());
                String existing = profile.getSolvedTitles();
                Set<String> allTitles = (existing == null || existing.isEmpty())
                        ? new HashSet<>()
                        : new HashSet<>(Arrays.asList(existing.split(",")));
                allTitles.addAll(recentTitles);
                profile.setSolvedTitles(String.join(",", allTitles));
            } catch (Exception e) {
                log.warn("Failed to fetch recent AC titles, but continuing with counts: {}", e.getMessage());
            }

            profile.setLastSyncedAt(LocalDateTime.now());

            return leetcodeProfileRepository.save(profile);

        } catch (Exception e) {
            log.error("Failed to sync LeetCode profile for {}", profile.getLeetcodeUsername(), e);
            throw new RuntimeException("Could not fetch LeetCode profile data. " + e.getMessage());
        }
    }

    private Map<String, Integer> fetchSolvedCounts(String leetcodeUsername) throws Exception {
        String query = """
                query userProblemsSolved($username: String!) {
                  matchedUser(username: $username) {
                    submitStatsGlobal {
                      acSubmissionNum {
                        difficulty
                        count
                      }
                    }
                  }
                }
                """;

        Map<String, Object> variables = new HashMap<>();
        variables.put("username", leetcodeUsername);

        Map<String, Object> body = new HashMap<>();
        body.put("query", query);
        body.put("variables", variables);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        headers.set("Referer", "https://leetcode.com/u/" + leetcodeUsername + "/");
        headers.set("Origin", "https://leetcode.com");
        headers.set("Accept", "application/json");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        String response = restTemplate.postForObject(LEETCODE_GRAPHQL_URL, entity, String.class);
        JsonNode root = objectMapper.readTree(response);
        JsonNode stats = root.path("data").path("matchedUser").path("submitStatsGlobal").path("acSubmissionNum");

        if (stats.isMissingNode() || !stats.isArray()) {
            throw new RuntimeException("Invalid username or profile is private.");
        }

        Map<String, Integer> result = new HashMap<>();
        for (JsonNode node : stats) {
            String difficulty = node.path("difficulty").asText();
            int count = node.path("count").asInt();
            result.put(difficulty, count);
        }
        return result;
    }

    private Set<String> fetchRecentAcTitles(String leetcodeUsername) throws Exception {
        String query = """
                query recentAcSubmissions($username: String!, $limit: Int) {
                  recentAcSubmissionList(username: $username, limit: $limit) {
                    title
                  }
                }
                """;

        Map<String, Object> variables = new HashMap<>();
        variables.put("username", leetcodeUsername);
        variables.put("limit", 100);

        Map<String, Object> body = new HashMap<>();
        body.put("query", query);
        body.put("variables", variables);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        headers.set("Referer", "https://leetcode.com/u/" + leetcodeUsername + "/");
        headers.set("Origin", "https://leetcode.com");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        String response = restTemplate.postForObject(LEETCODE_GRAPHQL_URL, entity, String.class);
        JsonNode root = objectMapper.readTree(response);
        JsonNode submissions = root.path("data").path("recentAcSubmissionList");

        if (submissions.isMissingNode() || !submissions.isArray()) {
            return Collections.emptySet();
        }

        Set<String> titles = new HashSet<>();
        for (JsonNode node : submissions) {
            titles.add(node.path("title").asText());
        }
        return titles;
    }

    public Optional<LeetcodeProfile> getProfile(String username) {
        return userRepository.findByUsername(username)
                .flatMap(user -> leetcodeProfileRepository.findByUserId(user.getId()));
    }
}
