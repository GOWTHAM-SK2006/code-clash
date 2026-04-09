package com.codeclash.service;

import com.codeclash.entity.*;
import com.codeclash.repository.*;
import com.codeclash.security.JwtUtil;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import jakarta.annotation.PostConstruct;

import com.codeclash.util.StringUtil;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminPanelService {

    private final UserRepository userRepository;
    private final ProblemRepository problemRepository;
    private final SubmissionRepository submissionRepository;
    private final BattleRepository battleRepository;
    private final BattleParticipantRepository battleParticipantRepository;
    private final BattleQueueRepository battleQueueRepository;
    private final CoinTransactionRepository coinTransactionRepository;
    private final EventBidRepository eventBidRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final LeetcodeProfileRepository leetcodeProfileRepository;
    private final SupportQueryRepository supportQueryRepository;
    private final QueryMessageRepository queryMessageRepository;
    private final AppSettingRepository appSettingRepository;
    private final Environment environment;
    private final JwtUtil jwtUtil;
    private final LearningService learningService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:admin123}")
    private String adminPassword;

    @Value("${app.admin.dashboard-url:/admin-dashboard.html}")
    private String adminDashboardUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Object> settings = new ConcurrentHashMap<>(new HashMap<>(Map.of(
            "platform", new HashMap<>(Map.of("allowRegistrations", true, "maintenanceMode", false)),
            "battle",
            new HashMap<>(
                    Map.of("maxDuration", 30, "allowFullscreen", true, "autoSubmit", true, "disqualifyOnExit", true,
                            "easyEnabled", true, "mediumEnabled", true, "hardEnabled", true)),
            "bidding", new HashMap<>(Map.of("entryFee", 100, "increment", 50, "duration", 10, "maxParticipants", 10)),
            "contest", new HashMap<>(Map.of("duration", 45, "delayAfterBidding", 2, "allowLateEntry", false)),
            "reward", new HashMap<>(Map.of("winCoins", 50, "dailyCoins", 10, "refundPolicy", true)),
            "safety", new HashMap<>(Map.of("antiCheat", true, "disableCopyPaste", true, "tabSwitchWarning", true)),
            "pages", new HashMap<>(Map.of(
                    "dashboard", true,
                    "learn", true,
                    "problems", true,
                    "battle", true,
                    "events", true,
                    "leaderboard", true,
                    "friends", true)))));

    @PostConstruct
    public void init() {
        initAdminAccount();
        initSettings();
    }

    public void initAdminAccount() {
        if (!userRepository.existsByUsername(adminUsername)) {
            User admin = User.builder()
                    .username(adminUsername)
                    .password(passwordEncoder.encode(adminPassword))
                    .email("admin@codeclash.com")
                    .displayName("Administrator")
                    .role("ADMIN")
                    .coins(0)
                    .problemsSolved(0)
                    .createdAt(LocalDateTime.now())
                    .build();
            userRepository.save(admin);
        }
    }

    private void initSettings() {
        List<AppSetting> dbSettings = appSettingRepository.findAll();
        if (dbSettings.isEmpty()) {
            // Save defaults to DB
            settings.forEach((key, value) -> {
                try {
                    String json = objectMapper.writeValueAsString(value);
                    appSettingRepository.save(new AppSetting(key, json));
                } catch (Exception e) {
                    System.err.println("Error saving default setting " + key + ": " + e.getMessage());
                }
            });
        } else {
            // Load from DB
            dbSettings.forEach(s -> {
                try {
                    Map<String, Object> section = objectMapper.readValue(s.getSettingValue(), 
                        new TypeReference<Map<String, Object>>() {});
                    settings.put(s.getSettingKey(), section);
                } catch (Exception e) {
                    // If not a map (e.g. simple string), put directly
                    try {
                        Object val = objectMapper.readValue(s.getSettingValue(), Object.class);
                        settings.put(s.getSettingKey(), val);
                    } catch (Exception e2) {
                        settings.put(s.getSettingKey(), s.getSettingValue());
                    }
                }
            });
        }
    }

    public Map<String, Object> adminLogin(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin credentials"));

        if (!"ADMIN".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access denied");
        }

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin credentials");
        }

        String token = jwtUtil.generateToken(username);

        return Map.of(
                "ok", true,
                "token", token,
                "redirect", adminDashboardUrl);
    }

    public void verifyAdminSession(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin session");
        }

        if (!jwtUtil.validateToken(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin session expired");
        }

        String username = jwtUtil.extractUsername(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin session"));

        if (!"ADMIN".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin session");
        }
    }

    public Map<String, Object> getUserDetails(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        long totalBattles = battleParticipantRepository.countByUserId(userId);
        long totalWins = battleRepository.countByWinnerId(userId);
        long solvedProblems = user.getProblemsSolved() != null ? user.getProblemsSolved() : 0;

        List<Map<String, Object>> recentSubmissions = submissionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().limit(5).map(this::mapSubmission).collect(Collectors.toList());

        // Get recent battles
        List<Map<String, Object>> recentBattles = battleParticipantRepository.findByUserId(userId).stream()
                .map(BattleParticipant::getBattle)
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparing(Battle::getStartedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(b -> {
                    Map<String, Object> row = new HashMap<>();
                    boolean isWinner = userId.equals(b.getWinnerId());
                    String resultStat = "LOST";
                    if (b.getWinnerId() == null)
                        resultStat = "DRAW";
                    else if (isWinner)
                        resultStat = "WON";

                    if ("CANCELLED".equals(b.getStatus()))
                        resultStat = "CANCELLED";

                    row.put("id", b.getId());
                    row.put("problem", b.getProblem() != null ? b.getProblem().getTitle() : "Unknown");
                    row.put("status", b.getStatus());
                    row.put("result", resultStat);
                    row.put("date", b.getStartedAt() != null ? b.getStartedAt().toString() : "");
                    return row;
                }).collect(Collectors.toList());

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalBattles", totalBattles);
        stats.put("totalWins", totalWins);
        stats.put("totalSolved", solvedProblems);
        stats.put("winRate", totalBattles > 0 ? Math.round((double) totalWins / totalBattles * 100) + "%" : "0%");

        Map<String, Object> details = new HashMap<>();
        details.put("user", Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "email", user.getEmail(),
                "displayName", safeName(user),
                "leetcodeUsername", user.getLeetcodeUsername() != null ? user.getLeetcodeUsername() : "",
                "role", user.getRole(),
                "coins", user.getCoins() != null ? user.getCoins() : 0,
                "section", user.getSection() != null ? user.getSection() : "-",
                "createdAt", user.getCreatedAt() != null ? user.getCreatedAt().toString() : ""));
        details.put("stats", stats);
        details.put("recentSubmissions", recentSubmissions);
        details.put("recentBattles", recentBattles);

        return details;
    }
    
    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Cascading deletion of all user data
        submissionRepository.deleteByUserId(userId);
        battleParticipantRepository.deleteByUserId(userId);
        leetcodeProfileRepository.deleteByUserId(userId);
        
        // Use existing deleteByUser for BattleQueue
        battleQueueRepository.deleteByUser(user);
        
        coinTransactionRepository.deleteByUserId(userId);
        eventBidRepository.deleteByUserId(userId);
        queryMessageRepository.deleteBySenderId(userId);
        queryMessageRepository.deleteByQueryUserId(userId);
        supportQueryRepository.deleteByUserId(userId);
        notificationRepository.deleteByUser_Id(userId);
        
        // Friend Requests: user can be requester or receiver
        friendRequestRepository.deleteByRequesterIdOrReceiverId(userId, userId);
        
        // References in battles: set winnerId to null if this user was the winner
        battleRepository.clearWinnerId(userId);

        // Finally, delete the user record
        userRepository.delete(user);
    }

    public Map<String, Object> changeAdminPassword(String token, String currentPassword, String newPassword) {
        verifyAdminSession(token);
        String username = jwtUtil.extractUsername(token);
        User admin = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));

        if (!passwordEncoder.matches(currentPassword, admin.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password incorrect");
        }

        admin.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(admin);

        return Map.of("ok", true, "message", "Password changed successfully");
    }

    @Transactional
    public Map<String, Object> resetUserPassword(String token, Long userId, String adminPassword) {
        verifyAdminSession(token);

        // Verify admin password
        User admin = userRepository.findByUsername(adminUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin user not found"));

        if (!passwordEncoder.matches(adminPassword, admin.getPassword())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Incorrect admin password");
        }

        // Find target user
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));

        if (targetUser.getUsername().equals(adminUsername)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use the change-password endpoint for admin accounts");
        }

        // Generate and set new password
        String newPassword = generateRandomPassword(12);
        targetUser.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(targetUser);

        return Map.of(
            "ok", true, 
            "message", "User password reset successfully", 
            "newPassword", newPassword
        );
    }

    private String generateRandomPassword(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    public Map<String, Object> getOverview() {
        List<User> users = userRepository.findAll();
        List<Problem> problems = problemRepository.findAll();
        List<Submission> submissions = submissionRepository.findAll();
        List<Battle> battles = battleRepository.findAll();

        long activeBattles = battles.stream()
                .filter(b -> !"FINISHED".equalsIgnoreCase(b.getStatus())
                        && !"CANCELLED".equalsIgnoreCase(b.getStatus()))
                .count();

        List<Map<String, Object>> dailySubmissions = buildDailySubmissions(submissions, 7);
        List<Map<String, Object>> activeUsers = buildActiveUsers(submissions, 12);

        return Map.of(
                "stats", Map.of(
                        "totalUsers", users.size(),
                        "totalProblems", problems.size(),
                        "totalSubmissions", submissions.size(),
                        "totalBattlesPlayed", battles.size(),
                        "activeBattles", activeBattles),
                "charts", Map.of(
                        "dailySubmissions", dailySubmissions,
                        "activeUsers", activeUsers));
    }

    public List<Map<String, Object>> getLiveBattles() {
        List<Battle> battles = battleRepository.findAll().stream()
                .filter(b -> !"FINISHED".equalsIgnoreCase(b.getStatus())
                        && !"CANCELLED".equalsIgnoreCase(b.getStatus()))
                .sorted(Comparator.comparing(Battle::getStartedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Battle battle : battles) {
            List<BattleParticipant> participants = battleParticipantRepository.findByBattleId(battle.getId());
            BattleParticipant p1 = participants.size() > 0 ? participants.get(0) : null;
            BattleParticipant p2 = participants.size() > 1 ? participants.get(1) : null;

            String status = "Coding";
            boolean anySubmitted = participants.stream().anyMatch(p -> p.getSubmittedAt() != null);
            if ("FINISHED".equalsIgnoreCase(battle.getStatus()))
                status = "Finished";
            else if (anySubmitted)
                status = "Submitted";

            long elapsed = 0;
            if (battle.getStartedAt() != null) {
                elapsed = ChronoUnit.SECONDS.between(battle.getStartedAt(), LocalDateTime.now());
            }

            rows.add(Map.of(
                    "id", battle.getId(),
                    "player1", p1 != null ? safeName(p1.getUser()) : "Player 1",
                    "player2", p2 != null ? safeName(p2.getUser()) : "Player 2",
                    "player1Id", p1 != null ? p1.getUser().getId() : 0,
                    "player2Id", p2 != null ? p2.getUser().getId() : 0,
                    "problemName", battle.getProblem() != null ? battle.getProblem().getTitle() : "Problem",
                    "status", status,
                    "elapsedSec", Math.max(0, elapsed)));
        }
        return rows;
    }

    public Map<String, Object> forceEndBattle(Long battleId) {
        Battle battle = battleRepository.findById(battleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Battle not found"));
        battle.setStatus("FINISHED");
        battle.setEndedAt(LocalDateTime.now());
        battleRepository.save(battle);
        return Map.of("ok", true, "battleId", battleId);
    }

    public Map<String, Object> disqualifyUser(Long battleId, Long userId) {
        Battle battle = battleRepository.findById(battleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Battle not found"));

        List<BattleParticipant> participants = battleParticipantRepository.findByBattleId(battleId);
        Long winnerId = participants.stream()
                .map(p -> p.getUser().getId())
                .filter(id -> !id.equals(userId))
                .findFirst()
                .orElse(null);

        battle.setStatus("CANCELLED");
        battle.setWinnerId(winnerId);
        battle.setEndedAt(LocalDateTime.now());
        battleRepository.save(battle);

        return Map.of("ok", true, "battleId", battleId, "winnerId", winnerId);
    }

    public List<Map<String, Object>> getMatchHistory(String date, String user, String result) {
        List<Battle> finished = battleRepository.findAll().stream()
                .filter(b -> "FINISHED".equalsIgnoreCase(b.getStatus()) || "CANCELLED".equalsIgnoreCase(b.getStatus()))
                .sorted(Comparator.comparing(Battle::getEndedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Battle battle : finished) {
            List<BattleParticipant> participants = battleParticipantRepository.findByBattleId(battle.getId());
            String p1 = participants.size() > 0 ? safeName(participants.get(0).getUser()) : "-";
            String p2 = participants.size() > 1 ? safeName(participants.get(1).getUser()) : "-";
            String winner = "Draw";
            if (battle.getWinnerId() != null) {
                winner = participants.stream()
                        .map(BattleParticipant::getUser)
                        .filter(u -> u.getId().equals(battle.getWinnerId()))
                        .map(this::safeName)
                        .findFirst()
                        .orElse("Unknown");
            }

            long durationSec = 0;
            if (battle.getStartedAt() != null && battle.getEndedAt() != null) {
                durationSec = ChronoUnit.SECONDS.between(battle.getStartedAt(), battle.getEndedAt());
            }

            LocalDate matchDate = battle.getEndedAt() != null ? battle.getEndedAt().toLocalDate() : null;
            if (date != null && !date.isBlank() && matchDate != null && !date.equals(matchDate.toString()))
                continue;
            if (user != null && !user.isBlank()) {
                String q = user.toLowerCase();
                if (!p1.toLowerCase().contains(q) && !p2.toLowerCase().contains(q))
                    continue;
            }
            if (result != null && !result.isBlank()) {
                String computed = "Draw";
                if ("Draw".equals(winner))
                    computed = "Draw";
                else
                    computed = "Win";
                if (!computed.equalsIgnoreCase(result))
                    continue;
            }

            rows.add(Map.of(
                    "id", battle.getId(),
                    "player1", p1,
                    "player2", p2,
                    "winner", winner,
                    "problem", battle.getProblem() != null ? battle.getProblem().getTitle() : "-",
                    "durationSec", Math.max(0, durationSec),
                    "status", battle.getStatus(),
                    "endedAt", battle.getEndedAt() != null ? battle.getEndedAt().toString() : ""));
        }

        return rows;
    }

    public List<Map<String, Object>> getProblems() {
        return problemRepository.findAll().stream().map(p -> Map.of(
                "id", p.getId(),
                "title", StringUtil.safe(p.getTitle()),
                "description", StringUtil.safe(p.getDescription()),
                "difficulty", StringUtil.safe(p.getDifficulty()),
                "tags", splitTags(p.getCategory()),
                "constraints", "",
                "functionSignature", extractFunctionSignature(p.getWrapperConfig()),
                "points", p.getPoints() != null ? p.getPoints() : 10)).collect(Collectors.toList());
    }

    public Problem createProblem(Map<String, Object> body) {
        Problem p = new Problem();
        p.setTitle(StringUtil.safe(body.get("title")));
        p.setDescription(StringUtil.safe(body.get("description")));
        p.setDifficulty(defaultIfBlank(StringUtil.safe(body.get("difficulty")), "Easy"));
        p.setCategory(String.join(",", StringUtil.parseStringList(body.get("tags"))));
        p.setPoints(StringUtil.parseInt(body.get("points"), 10));
        p.setStarterCode(StringUtil.safe(body.get("starterCode")));
        p.setExpectedOutput(StringUtil.safe(body.get("expectedOutput")));
        p.setWrapperConfig(StringUtil.safe(body.get("functionSignature")));
        p.setTestCases("[]");
        return problemRepository.save(p);
    }

    public Problem updateProblem(Long id, Map<String, Object> body) {
        Problem p = problemRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not found"));

        if (body.containsKey("title"))
            p.setTitle(StringUtil.safe(body.get("title")));
        if (body.containsKey("description"))
            p.setDescription(StringUtil.safe(body.get("description")));
        if (body.containsKey("difficulty"))
            p.setDifficulty(StringUtil.safe(body.get("difficulty")));
        if (body.containsKey("tags"))
            p.setCategory(String.join(",", StringUtil.parseStringList(body.get("tags"))));
        if (body.containsKey("points"))
            p.setPoints(StringUtil.parseInt(body.get("points"), p.getPoints() == null ? 10 : p.getPoints()));
        if (body.containsKey("starterCode"))
            p.setStarterCode(StringUtil.safe(body.get("starterCode")));
        if (body.containsKey("expectedOutput"))
            p.setExpectedOutput(StringUtil.safe(body.get("expectedOutput")));
        if (body.containsKey("functionSignature"))
            p.setWrapperConfig(StringUtil.safe(body.get("functionSignature")));

        return problemRepository.save(p);
    }

    public void deleteProblem(Long id) {
        if (!problemRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not found");
        }
        problemRepository.deleteById(id);
    }

    public List<Map<String, Object>> getTestcases(Long problemId) {
        Problem p = problemRepository.findById(problemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not found"));

        List<Map<String, Object>> rows = parseTestcases(p.getTestCases());
        for (int i = 0; i < rows.size(); i++) {
            rows.get(i).putIfAbsent("visible", i < 3);
            rows.get(i).put("id", i + 1);
        }
        return rows;
    }

    public Map<String, Object> updateTestcases(Long problemId, List<Map<String, Object>> testcases) {
        Problem p = problemRepository.findById(problemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not found"));

        if (testcases == null || testcases.size() != 15) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exactly 15 testcases required");
        }
        long visible = testcases.stream().filter(tc -> Boolean.TRUE.equals(tc.get("visible"))).count();
        if (visible != 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exactly 3 testcases must be visible");
        }

        try {
            p.setTestCases(objectMapper.writeValueAsString(testcases));
            problemRepository.save(p);
            return Map.of("ok", true, "total", 15, "visible", 3, "hidden", 12);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid testcase payload");
        }
    }

    public List<Map<String, Object>> getUsers() {
        return userRepository.findAll().stream().map(u -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("username", StringUtil.safe(u.getUsername()));
            row.put("email", StringUtil.safe(u.getEmail()));
            row.put("displayName", safeName(u));
            row.put("role", StringUtil.safe(u.getRole()));
            row.put("coins", u.getCoins() == null ? 0 : u.getCoins());
            row.put("problemsSolved", u.getProblemsSolved() == null ? 0 : u.getProblemsSolved());
            row.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
            return row;
        }).collect(Collectors.toList());
    }

    public User setUserBan(Long userId, boolean banned) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setRole(banned ? "BANNED" : "USER");
        return userRepository.save(user);
    }

    public User resetUserStats(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setCoins(0);
        user.setProblemsSolved(0);
        return userRepository.save(user);
    }

    public List<Map<String, Object>> getUserSubmissions(Long userId) {
        return submissionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapSubmission)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getSubmissions(String status) {
        return submissionRepository.findAll().stream()
                .filter(s -> status == null || status.isBlank() || status.equalsIgnoreCase(s.getStatus()))
                .sorted(Comparator.comparing(Submission::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapSubmission)
                .collect(Collectors.toList());
    }

    public List<Map<String, Object>> getErrorLogs() {
        return submissionRepository.findAll().stream()
                .filter(s -> !"ACCEPTED".equalsIgnoreCase(s.getStatus()) && !"PASSED".equalsIgnoreCase(s.getStatus()))
                .sorted(Comparator.comparing(Submission::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(s -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", s.getId());
                    row.put("type", StringUtil.safe(s.getStatus()));
                    row.put("message", abbreviate(StringUtil.safe(s.getOutput()), 300));
                    row.put("user", s.getUser() != null ? safeName(s.getUser()) : "-");
                    row.put("problem",
                            s.getProblem() != null ? StringUtil.safe(s.getProblem().getTitle()) : "-");
                    row.put("createdAt", s.getCreatedAt() != null ? s.getCreatedAt().toString() : "");
                    return row;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> clearErrorLogs() {
        List<Submission> failed = submissionRepository.findAll().stream()
                .filter(s -> !"ACCEPTED".equalsIgnoreCase(s.getStatus()) && !"PASSED".equalsIgnoreCase(s.getStatus()))
                .collect(Collectors.toList());
        submissionRepository.deleteAll(failed);
        return Map.of("ok", true, "count", failed.size());
    }

    public List<Map<String, Object>> getLeaderboard() {
        List<User> users = userRepository.findAllByRoleNotOrderByCoinsDesc("ADMIN");
        List<Map<String, Object>> rows = new ArrayList<>();
        int rank = 1;
        for (User u : users) {
            rows.add(Map.of(
                    "rank", rank++,
                    "id", u.getId(),
                    "name", safeName(u),
                    "coins", u.getCoins() == null ? 0 : u.getCoins(),
                    "battleWins", battleRepository.countByWinnerId(u.getId()),
                    "battlesAttended", battleParticipantRepository.countByUserId(u.getId()),
                    "problemsSolved", u.getProblemsSolved() == null ? 0 : u.getProblemsSolved()));
        }
        return rows;
    }

    public Map<String, Object> resetLeaderboard() {
        List<User> users = userRepository.findAll();
        for (User u : users) {
            u.setCoins(0);
        }
        userRepository.saveAll(users);
        return Map.of("ok", true);
    }

    public List<SupportQuery> getSupportQueries() {
        return supportQueryRepository.findAllByOrderByUpdatedAtDesc();
    }

    @Transactional
    public void resolveSupportQuery(Long id) {
        SupportQuery query = supportQueryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        query.setStatus("RESOLVED");
        supportQueryRepository.save(query);
    }

    public List<QueryMessage> getQueryMessages(Long queryId) {
        SupportQuery query = supportQueryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        return queryMessageRepository.findByQueryOrderByCreatedAtAsc(query);
    }

    @Transactional
    public QueryMessage adminReply(Long queryId, String token, String content) {
        verifyAdminSession(token);
        String username = jwtUtil.extractUsername(token);
        User admin = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin session"));

        SupportQuery query = supportQueryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));

        QueryMessage message = QueryMessage.builder()
                .query(query)
                .sender(admin)
                .content(content)
                .build();

        query.setStatus("OPEN");
        supportQueryRepository.save(query);
        
        // Notify user
        notificationService.sendNotification(
                query.getUser(),
                "SUPPORT_REPLY",
                "Support Reply",
                "An admin has replied to your query: " + query.getSubject(),
                "messages.html?id=" + query.getId()
        );
        
        return queryMessageRepository.save(message);
    }

    public User adjustPoints(Long userId, Integer delta) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        int current = u.getCoins() == null ? 0 : u.getCoins();
        u.setCoins(Math.max(0, current + (delta == null ? 0 : delta)));
        return userRepository.save(u);
    }

    public Map<String, Object> getSettings() {
        return new LinkedHashMap<>(settings);
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> updateSettings(Map<String, Object> payload) {
        if (payload == null)
            return getSettings();
        
        payload.forEach((key, value) -> {
            if (value instanceof Map<?, ?> mapValue) {
                Map<String, Object> section = (Map<String, Object>) settings.computeIfAbsent(key,
                        k -> new ConcurrentHashMap<>());
                mapValue.forEach((k, v) -> section.put(String.valueOf(k), v));
                
                // Persist this section to DB
                try {
                    String json = objectMapper.writeValueAsString(section);
                    appSettingRepository.save(new AppSetting(key, json));
                } catch (Exception e) {
                    System.err.println("Error persisting setting " + key + ": " + e.getMessage());
                }
            } else {
                settings.put(key, value);
                // Persist simple value to DB
                try {
                    String json = objectMapper.writeValueAsString(value);
                    appSettingRepository.save(new AppSetting(key, json));
                } catch (Exception e) {
                    appSettingRepository.save(new AppSetting(key, String.valueOf(value)));
                }
            }
        });
        return getSettings();
    }

    public Map<String, Object> clearLearningContent() {
        learningService.clearAllLearningContent();
        return Map.of("ok", true, "message", "All topics and lessons cleared");
    }

    private List<Map<String, Object>> buildDailySubmissions(List<Submission> submissions, int days) {
        Map<LocalDate, Long> byDay = submissions.stream()
                .filter(s -> s.getCreatedAt() != null)
                .collect(Collectors.groupingBy(s -> s.getCreatedAt().toLocalDate(), Collectors.counting()));

        List<Map<String, Object>> rows = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            rows.add(Map.of(
                    "day", day.toString(),
                    "count", byDay.getOrDefault(day, 0L)));
        }
        return rows;
    }

    private List<Map<String, Object>> buildActiveUsers(List<Submission> submissions, int hours) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime min = now.minusHours(hours - 1).withMinute(0).withSecond(0).withNano(0);

        Map<LocalDateTime, Long> byHour = submissions.stream()
                .filter(s -> s.getCreatedAt() != null && !s.getCreatedAt().isBefore(min))
                .collect(Collectors.groupingBy(
                        s -> s.getCreatedAt().withMinute(0).withSecond(0).withNano(0),
                        Collectors.mapping(s -> s.getUser() != null ? s.getUser().getId() : -1L,
                                Collectors.collectingAndThen(Collectors.toSet(), set -> (long) set.size()))));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = hours - 1; i >= 0; i--) {
            LocalDateTime slot = now.minusHours(i).withMinute(0).withSecond(0).withNano(0);
            rows.add(Map.of(
                    "hour", slot.toLocalTime().truncatedTo(ChronoUnit.HOURS).toString(),
                    "count", byHour.getOrDefault(slot, 0L)));
        }
        return rows;
    }

    private List<Map<String, Object>> parseTestcases(String raw) {
        if (raw == null || raw.isBlank())
            return new ArrayList<>();
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {
            });
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> mapSubmission(Submission s) {
        int runtimeMs = Math.max(8, Math.min(2200, StringUtil.safe(s.getCode()).length() / 3 + 12));
        int memoryKb = 12000 + Math.min(6000, StringUtil.safe(s.getOutput()).length() * 2);

        return Map.of(
                "id", s.getId(),
                "user", s.getUser() != null ? safeName(s.getUser()) : "-",
                "problem", s.getProblem() != null ? StringUtil.safe(s.getProblem().getTitle()) : "-",
                "status", StringUtil.safe(s.getStatus()),
                "runtimeMs", runtimeMs,
                "memoryKb", memoryKb,
                "createdAt", s.getCreatedAt() != null ? s.getCreatedAt().toString() : "");
    }

    private String extractFunctionSignature(String wrapperConfig) {
        if (wrapperConfig == null || wrapperConfig.isBlank())
            return "";
        try {
            Map<String, Object> map = objectMapper.readValue(wrapperConfig, new TypeReference<>() {
            });
            Object name = map.get("functionName");
            if (name == null)
                return wrapperConfig;
            return String.valueOf(name);
        } catch (Exception e) {
            return wrapperConfig;
        }
    }

    private List<String> splitTags(String category) {
        if (category == null || category.isBlank())
            return List.of();
        return List.of(category.split(",")).stream()
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }

    public String safeName(User user) {
        String display = StringUtil.safe(user.getDisplayName()).trim();
        if (!display.isBlank())
            return display;
        return StringUtil.safe(user.getUsername());
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String abbreviate(String value, int max) {
        if (value == null)
            return "";
        if (value.length() <= max)
            return value;
        return value.substring(0, max) + "...";
    }
}
