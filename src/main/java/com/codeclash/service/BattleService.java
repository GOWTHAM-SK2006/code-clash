package com.codeclash.service;

import com.codeclash.dto.*;
import com.codeclash.entity.*;
import com.codeclash.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@Service
public class BattleService {

        private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

        private final BattleRepository battleRepository;
        private final BattleParticipantRepository participantRepository;
        private final ProblemRepository problemRepository;
        private final UserRepository userRepository;
        private final BattleQueueRepository queueRepository;
        private final CoinService coinService;
        private final DockerSandboxService dockerSandboxService;
        private final TemplateValidationService templateValidationService;
        private final ProblemService problemService;
        private final AdminPanelService adminPanelService;
        private final BattleInviteRepository inviteRepository;
        private final SimpMessagingTemplate messagingTemplate;

        public BattleService(BattleRepository battleRepository,
                        BattleParticipantRepository participantRepository,
                        ProblemRepository problemRepository,
                        UserRepository userRepository,
                        BattleQueueRepository queueRepository,
                        CoinService coinService,
                        DockerSandboxService dockerSandboxService,
                        TemplateValidationService templateValidationService,
                        ProblemService problemService,
                        AdminPanelService adminPanelService,
                        BattleInviteRepository inviteRepository,
                        SimpMessagingTemplate messagingTemplate) {
                this.battleRepository = battleRepository;
                this.participantRepository = participantRepository;
                this.problemRepository = problemRepository;
                this.userRepository = userRepository;
                this.queueRepository = queueRepository;
                this.coinService = coinService;
                this.dockerSandboxService = dockerSandboxService;
                this.templateValidationService = templateValidationService;
                this.problemService = problemService;
                this.adminPanelService = adminPanelService;
                this.inviteRepository = inviteRepository;
                this.messagingTemplate = messagingTemplate;
        }

        private void broadcastBattleStatus(Battle battle) {
                if (battle == null) return;
                try {
                        java.util.Map<String, Object> payload = new java.util.HashMap<>();
                        payload.put("battleId", battle.getId());
                        payload.put("status", battle.getStatus());
                        payload.put("winningTeamId", battle.getWinningTeamId() != null ? battle.getWinningTeamId() : 0);
                        payload.put("winnerId", battle.getWinnerId() != null ? battle.getWinnerId() : 0);
                        messagingTemplate.convertAndSend("/topic/battle/" + battle.getId() + "/status", payload);
                } catch (Exception e) {
                        // Non-critical sync - log and continue
                }
        }

        @Transactional
        public Map<String, Object> findMatch(String username, String difficultyInput) {
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                String difficulty = normalizeDifficulty(difficultyInput);

                // Check if difficulty is locked
                Map<String, Object> settings = adminPanelService.getSettings();
                Map<String, Object> battleSettings = (Map<String, Object>) settings.get("battle");
                if (battleSettings != null) {
                        boolean enabled = switch (difficulty.toLowerCase()) {
                                case "easy" -> (boolean) battleSettings.getOrDefault("easyEnabled", true);
                                case "medium" -> (boolean) battleSettings.getOrDefault("mediumEnabled", true);
                                case "hard" -> (boolean) battleSettings.getOrDefault("hardEnabled", true);
                                default -> true;
                        };
                        if (!enabled) {
                                throw new RuntimeException(
                                                difficulty + " difficulty is currently locked by administrator.");
                        }
                }

                int entryFee = getEntryFeeByDifficulty(difficulty);

                if (!coinService.hasEnoughCoins(user, entryFee)) {
                        throw new RuntimeException(
                                        "Not enough coins. " + difficulty + " battle requires " + entryFee + " coins");
                }

                // Check if user is already in a battle or in queue
                Optional<BattleParticipant> activeParticipant = participantRepository
                                .findTopByUserIdOrderByBattleIdDesc(user.getId());
                if (activeParticipant.isPresent()) {
                        Battle battle = activeParticipant.get().getBattle();
                        if ("ACTIVE".equals(battle.getStatus())) {
                                return Map.of("status", "matched", "battleId", battle.getId());
                        }
                }

                Optional<BattleQueue> waitingUser = queueRepository
                                .findFirstByDifficultyIgnoreCaseOrderByCreatedAtAsc(difficulty)
                                .filter(queue -> !queue.getUser().getId().equals(user.getId()));

                if (waitingUser.isEmpty()) {
                        BattleQueue queueEntry = queueRepository.findByUser(user)
                                        .orElseGet(BattleQueue::new);
                        queueEntry.setUser(user);
                        queueEntry.setDifficulty(difficulty);
                        queueEntry.setCreatedAt(LocalDateTime.now());
                        queueRepository.save(queueEntry);
                        return Map.of("status", "waiting", "difficulty", difficulty);
                }

                BattleQueue currentUserQueue = queueRepository.findByUser(user).orElse(null);
                if (currentUserQueue != null) {
                        queueRepository.delete(currentUserQueue);
                }

                BattleQueue matchedQueueEntry = waitingUser.get();
                User opponent = matchedQueueEntry.getUser();

                if (!coinService.hasEnoughCoins(opponent, entryFee)) {
                        queueRepository.delete(matchedQueueEntry);

                        BattleQueue queueEntry = queueRepository.findByUser(user)
                                        .orElseGet(BattleQueue::new);
                        queueEntry.setUser(user);
                        queueEntry.setDifficulty(difficulty);
                        queueEntry.setCreatedAt(LocalDateTime.now());
                        queueRepository.save(queueEntry);
                        return Map.of("status", "waiting", "difficulty", difficulty);
                }

                queueRepository.delete(matchedQueueEntry);

                coinService.spendCoins(user, entryFee, "Battle entry fee (" + difficulty + ")");
                coinService.spendCoins(opponent, entryFee, "Battle entry fee (" + difficulty + ")");

                // Randomly select a problem from selected difficulty
                List<Problem> problems = problemRepository.findByDifficulty(difficulty);
                if (problems.isEmpty()) {
                        List<Problem> allProblems = problemRepository.findAll();
                        problems = allProblems.stream()
                                        .filter(problem -> problem.getDifficulty() != null)
                                        .filter(problem -> difficulty.equalsIgnoreCase(problem.getDifficulty()))
                                        .collect(Collectors.toList());
                }

                if (problems.isEmpty()) {
                        throw new RuntimeException("No problems available for " + difficulty + " difficulty");
                }

                Problem randomProblem = problems.get(new java.util.Random().nextInt(problems.size()));

                // Pre-battle check: Validate and auto-fix template if needed
                templateValidationService.autoFixIfNeeded(randomProblem);

                Battle battle = new Battle();
                battle.setProblem(randomProblem);
                battle.setStatus("ACTIVE");
                battle.setStartedAt(LocalDateTime.now());
                battle.setTimeLimitSeconds(getBattleDurationSecondsByDifficulty(randomProblem.getDifficulty()));
                battleRepository.save(battle);

                // Add both participants
                saveParticipant(battle, user, 1);
                saveParticipant(battle, opponent, 2);

                return Map.of(
                                "status", "matched",
                                "battleId", battle.getId(),
                                "problemName", randomProblem.getTitle(),
                                 "opponentName", opponent.getDisplayName(),
                                "difficulty", difficulty);
        }

        @Transactional
        public Map<String, Object> inviteToTeamBattle(String requesterUsername, Long friendId) {
                User sender = userRepository.findByUsername(requesterUsername)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                User friend = userRepository.findById(friendId)
                                .orElseThrow(() -> new RuntimeException("Friend not found"));

                // Create a new 2v2 battle
                // For simplicity, we create the battle and wait for another team
                List<Problem> problems = problemRepository.findByDifficulty("Easy");
                Problem problem = problems.get(new java.util.Random().nextInt(problems.size()));

                Battle battle = new Battle();
                battle.setProblem(problem);
                battle.setStatus("WAITING_TEAM");
                battle.setMode("2v2");
                battle.setStartedAt(LocalDateTime.now());
                battle.setTimeLimitSeconds(1200); // 20 mins for 2v2
                battleRepository.save(battle);

                // Add both to Team 1
                saveParticipant(battle, sender, 1);
                saveParticipant(battle, friend, 1);

                return Map.of(
                                 "status", "waiting_for_opponents",
                                 "battleId", battle.getId());
        }

        @Transactional
        public Map<String, Object> sendBattleInvite(String requesterUsername, Long friendId, String difficulty) {
                User sender = userRepository.findByUsername(requesterUsername)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                User friend = userRepository.findById(friendId)
                                .orElseThrow(() -> new RuntimeException("Friend not found"));

                // Check entry fee
                int entryFee = getEntryFeeByDifficulty(difficulty);
                if (!coinService.hasEnoughCoins(sender, entryFee)) {
                        throw new RuntimeException("Insufficient coins. " + difficulty + " team recruitment requires " + entryFee + " coins.");
                }

                // Check if friend is online
                if (!isUserOnline(friend)) {
                        throw new RuntimeException("Friend is currently offline");
                }

                // Check for existing pending invite - REMOVED to allow re-pings
                // Optional<BattleInvite> existing = inviteRepository
                //                 .findFirstBySenderAndReceiverAndStatusOrderByCreatedAtDesc(sender, friend, "PENDING");
                // if (existing.isPresent()) {
                //         throw new RuntimeException("You already have a pending invite sent to this friend");
                // }

                BattleInvite invite = BattleInvite.builder()
                                .sender(sender)
                                .receiver(friend)
                                .difficulty(difficulty != null ? difficulty : "Easy")
                                .status("PENDING")
                                .build();
                inviteRepository.save(invite);

                // Send WebSocket notification to friend
                messagingTemplate.convertAndSend("/topic/notifications/" + friend.getUsername(), 
                        Map.of(
                                "type", "BATTLE_INVITE",
                                "inviteId", invite.getId(),
                                "fromUsername", sender.getUsername(),
                                "fromDisplayName", sender.getDisplayName() != null ? sender.getDisplayName() : sender.getUsername(),
                                "message", "invited you to a 2v2 Team Battle!"
                        )
                );

                // Deduct coins from requester
                coinService.spendCoins(sender, entryFee, "2v2 Battle Recruitment Entry Fee (" + (difficulty != null ? difficulty : "Easy") + ")");

                return Map.of("status", "sent", "inviteId", invite.getId());
        }

        @Transactional
        public Map<String, Object> acceptBattleInvite(String username, Long inviteId) {
                User receiver = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                BattleInvite invite = inviteRepository.findById(inviteId)
                                .orElseThrow(() -> new RuntimeException("Invite not found"));

                if (!invite.getReceiver().getId().equals(receiver.getId())) {
                        throw new RuntimeException("Unauthorized");
                }

                if (!"PENDING".equalsIgnoreCase(invite.getStatus())) {
                        throw new RuntimeException("Invite is no longer pending");
                }

                String difficulty = invite.getDifficulty() != null ? invite.getDifficulty() : "Easy";
                
                int entryFee = getEntryFeeByDifficulty(difficulty);
                if (!coinService.hasEnoughCoins(receiver, entryFee)) {
                        throw new RuntimeException("Insufficient coins to join this " + difficulty + " mission (" + entryFee + " required).");
                }
                
                // Deduct coins from receiver
                coinService.spendCoins(receiver, entryFee, "2v2 Battle Mission Acceptance (" + difficulty + ")");

                // 1. Check if ANY team is already waiting for this difficulty in 2v2
                Optional<Battle> waitingBattle = battleRepository
                        .findFirstByModeAndStatusAndProblemDifficultyIgnoreCaseOrderByStartedAtAsc("2v2", "WAITING", difficulty);

                if (waitingBattle.isPresent()) {
                        // MATCH FOUND! 
                        Battle battle = waitingBattle.get();
                        
                        // Add this new team (Sender & Receiver) as Team 2
                        saveParticipant(battle, invite.getSender(), 2);
                        saveParticipant(battle, receiver, 2);
                        
                        // Start the battle
                        battle.setStatus("ACTIVE");
                        battle.setStartedAt(LocalDateTime.now());
                        battleRepository.save(battle);
                        
                        invite.setStatus("ACCEPTED");
                        invite.setBattleId(battle.getId());
                        inviteRepository.save(invite);

                        // Notify ALL 4 participants via WebSocket
                        var participants = getBattleParticipants(battle.getId());
                        for (var p : participants) {
                                messagingTemplate.convertAndSend("/topic/notifications/" + p.getUser().getUsername(), 
                                        Map.of(
                                                "type", "BATTLE_MATCHED",
                                                "battleId", battle.getId()
                                        )
                                );
                        }

                        return Map.of("status", "matched", "battleId", battle.getId());
                } else {
                        // NO TEAM WAITING -> Create a WAITING battle for this duo
                        List<Problem> problems = problemRepository.findByDifficulty(difficulty);
                        if (problems.isEmpty()) {
                                problems = problemRepository.findByDifficulty("Easy");
                        }
                        Problem problem = problems.get(new java.util.Random().nextInt(problems.size()));

                        Battle battle = new Battle();
                        battle.setProblem(problem);
                        battle.setStatus("WAITING"); // Waiting for opponents
                        battle.setMode("2v2");
                        battle.setStartedAt(LocalDateTime.now());
                        battle.setTimeLimitSeconds(1200);
                        battleRepository.save(battle);

                        // Add this duo as Team 1
                        saveParticipant(battle, invite.getSender(), 1);
                        saveParticipant(battle, receiver, 1);

                        invite.setStatus("ACCEPTED");
                        invite.setBattleId(battle.getId());
                        inviteRepository.save(invite);

                        // Notify both members of Team 1
                        Map<String, Object> teamReadyMsg = Map.of(
                                "type", "BATTLE_TEAM_READY",
                                "battleId", battle.getId(),
                                "difficulty", difficulty
                        );
                        messagingTemplate.convertAndSend("/topic/notifications/" + invite.getSender().getUsername(), teamReadyMsg);
                        messagingTemplate.convertAndSend("/topic/notifications/" + receiver.getUsername(), teamReadyMsg);

                        return Map.of("status", "waiting_for_opponents", "battleId", battle.getId());
                }
        }

        private boolean isUserOnline(User user) {
                if (user == null || user.getLastActiveAt() == null) return false;
                return user.getLastActiveAt().isAfter(LocalDateTime.now().minusMinutes(5));
        }

        private void saveParticipant(Battle battle, User user, Integer teamId) {
                BattleParticipant participant = new BattleParticipant();
                participant.setBattle(battle);
                participant.setUser(user);
                participant.setTeamId(teamId);
                participantRepository.save(participant);
        }

        private String normalizeDifficulty(String difficultyInput) {
                if (difficultyInput == null || difficultyInput.isBlank()) {
                        return "Easy";
                }

                return switch (difficultyInput.trim().toLowerCase()) {
                        case "easy" -> "Easy";
                        case "medium" -> "Medium";
                        case "hard" -> "Hard";
                        default -> throw new RuntimeException("Invalid difficulty. Use Easy, Medium, or Hard");
                };
        }

        private int getEntryFeeByDifficulty(String difficultyInput) {
                if (difficultyInput == null || difficultyInput.isBlank()) {
                        return 15;
                }

                return switch (difficultyInput.trim().toLowerCase()) {
                        case "easy" -> 15;
                        case "medium" -> 20;
                        case "hard" -> 30;
                        default -> 15;
                };
        }

        private void saveParticipant(Battle battle, User user) {
                BattleParticipant participant = new BattleParticipant();
                participant.setBattle(battle);
                participant.setUser(user);
                participantRepository.save(participant);
        }

        public Optional<Battle> getActiveBattleForUser(String username) {
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                return participantRepository.findTopByUserIdOrderByBattleIdDesc(user.getId())
                                .map(BattleParticipant::getBattle)
                                .filter(b -> "ACTIVE".equals(b.getStatus()));
        }

        @Transactional
        public Battle createBattle(String username, BattleRequest request) {
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                Problem problem = problemRepository.findById(request.getProblemId())
                                .orElseThrow(() -> new RuntimeException("Problem not found"));

                Battle battle = new Battle();
                battle.setProblem(problem);
                battle.setStatus("WAITING");
                battle.setTimeLimitSeconds(getBattleDurationSecondsByDifficulty(problem.getDifficulty()));
                battleRepository.save(battle);

                BattleParticipant participant = new BattleParticipant();
                participant.setBattle(battle);
                participant.setUser(user);
                participant.setTeamId(1);
                participantRepository.save(participant);

                return battle;
        }

        @Transactional
        public Battle joinBattle(Long battleId, String username) {
                Battle battle = battleRepository.findById(battleId)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (!"WAITING".equals(battle.getStatus())) {
                        throw new RuntimeException("Battle already started or finished");
                }

                if (participantRepository.countByBattleId(battleId) >= 2) {
                        throw new RuntimeException("Battle is full");
                }

                BattleParticipant participant = new BattleParticipant();
                participant.setBattle(battle);
                participant.setUser(user);
                participant.setTeamId(2);
                participantRepository.save(participant);

                battle.setStatus("ACTIVE");
                battle.setStartedAt(LocalDateTime.now());
                if (battle.getTimeLimitSeconds() == null || battle.getTimeLimitSeconds() <= 0) {
                        battle.setTimeLimitSeconds(
                                        getBattleDurationSecondsByDifficulty(battle.getProblem().getDifficulty()));
                }
                battleRepository.save(battle);

                broadcastBattleStatus(battle);
                return battle;
        }

        @Transactional
        public Battle submitBattleSolution(Long battleId, String username, BattleSubmitRequest request) {
                Battle battle = battleRepository.findById(battleId)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (isBattleTimeExpired(battle)) {
                        return concludeBattleAsDraw(battle);
                }

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        throw new RuntimeException("Battle is not active");
                }

                List<BattleParticipant> participants = participantRepository.findByBattleId(battleId);
                BattleParticipant myEntry = participants.stream()
                                .filter(p -> p.getUser().getId().equals(user.getId()))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Not a participant"));

                myEntry.setCode(request.getCode());
                myEntry.setSubmittedAt(LocalDateTime.now());

                String language = normalizeLanguage(request.getLanguage());

                boolean correct = evaluateBattleSubmission(battle.getProblem(), request.getCode(), language);

                myEntry.setIsCorrect(correct);
                participantRepository.save(myEntry);

                if (correct && battle.getWinnerId() == null) {
                        battle.setWinnerId(user.getId());
                        battle.setWinningTeamId(myEntry.getTeamId());
                        battle.setStatus("FINISHED");
                        battle.setEndedAt(LocalDateTime.now());
                        battleRepository.save(battle);
                        
                        int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                        int winnerReward = fee * 2;
                        
                        // Award BOTH members of the winning team
                        participants.stream()
                                .filter(p -> p.getTeamId().equals(myEntry.getTeamId()))
                                .forEach(p -> coinService.awardCoins(p.getUser(), winnerReward, "2v2 Battle Victory Reward (2x) #" + battleId));
                                
                } else if (!correct && battle.getWinnerId() == null) {
                        // Current team failed (or just user?), find opponent team
                        // In 2v2, if one fails, the other team wins immediately
                        int opponentTeamId = (myEntry.getTeamId() == 1) ? 2 : 1;
                        
                        battle.setWinnerId(null); // Or pick any opponent ID
                        battle.setWinningTeamId(opponentTeamId);
                        battle.setStatus("FINISHED");
                        battle.setEndedAt(LocalDateTime.now());
                        battleRepository.save(battle);
                        
                        int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                        int winnerReward = fee * 2;
                        
                        participants.stream()
                                .filter(p -> p.getTeamId().equals(opponentTeamId))
                                .forEach(p -> coinService.awardCoins(p.getUser(), winnerReward, "2v2 Victory (Opponent failed mission) #" + battleId));
                }


                broadcastBattleStatus(battle);
                return battle;
        }

        public Map<String, Object> runBattleCode(Long battleId, String username, BattleSubmitRequest request) {
                Battle battle = battleRepository.findById(battleId)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));

                if (isBattleTimeExpired(battle)) {
                        concludeBattleAsDraw(battle);
                        throw new RuntimeException("Battle time expired. Match ended in a draw");
                }

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        throw new RuntimeException("Battle is not active");
                }

                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                participantRepository.findByBattleId(battleId).stream()
                                .filter(p -> p.getUser().getId().equals(user.getId()))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Not a participant"));

                if (request == null || request.getCode() == null || request.getCode().isBlank()) {
                        throw new RuntimeException("Code is required");
                }

                String language = normalizeLanguage(request.getLanguage());
                DockerSandboxService.ExecutionResult result = runBattleCode(battle.getProblem(), request.getCode(),
                                language, request.getInputData());

                String cleanedStderr = cleanRunnerWarning(result.getStderr());

                return Map.of(
                                "stdout", result.getStdout() == null ? "" : result.getStdout(),
                                "stderr", cleanedStderr,
                                "exitCode", result.getExitCode(),
                                "timedOut", result.isTimedOut(),
                                "language", language);
        }

        @Transactional
        public Battle cancelBattle(Long battleId, String username) {
                Battle battle = battleRepository.findById(battleId)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));

                if (isBattleTimeExpired(battle)) {
                        return concludeBattleAsDraw(battle);
                }

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        throw new RuntimeException("Only active battles can be cancelled");
                }

                User cancellingUser = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                List<BattleParticipant> participants = participantRepository.findByBattleId(battleId);
                if (participants.size() < 2) {
                        throw new RuntimeException("Battle does not have enough participants");
                }

                BattleParticipant cancellingEntry = participants.stream()
                                .filter(p -> p.getUser().getId().equals(cancellingUser.getId()))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Not a participant of this battle"));

                int opponentTeamId = (cancellingEntry.getTeamId() == 1) ? 2 : 1;
                int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                int reward = fee * 2;

                // Find an opponent to set as winnerId (for 1v1 compatibility)
                BattleParticipant opponentEntry = participants.stream()
                        .filter(p -> p.getTeamId().equals(opponentTeamId))
                        .findFirst().orElse(null);

                battle.setStatus("CANCELLED");
                battle.setWinningTeamId(opponentTeamId);
                if (opponentEntry != null) {
                        battle.setWinnerId(opponentEntry.getUser().getId());
                }
                battle.setEndedAt(LocalDateTime.now());
                battleRepository.save(battle);

                // Award BOTH members of the opponent team
                participants.stream()
                        .filter(p -> p.getTeamId().equals(opponentTeamId))
                        .forEach(p -> coinService.awardCoins(p.getUser(), reward, "Battle cancel win reward (2x) #" + battleId));

                broadcastBattleStatus(battle);
                return battle;
        }

        @Transactional
        public Battle timeoutBattle(Long battleId, String username) {
                Battle battle = battleRepository.findById(battleId)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));

                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                List<BattleParticipant> participants = participantRepository.findByBattleId(battleId);
                BattleParticipant timeoutEntry = participants.stream()
                                .filter(p -> p.getUser().getId().equals(user.getId()))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Not a participant"));

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        return battle;
                }

                // In 2v2, if one timeouts, the other team wins
                int opponentTeamId = (timeoutEntry.getTeamId() == 1) ? 2 : 1;
                int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                int reward = fee * 2;
                
                // Find an opponent for winnerId fallback
                BattleParticipant opponentEntry = participants.stream()
                        .filter(p -> p.getTeamId().equals(opponentTeamId))
                        .findFirst().orElse(null);

                battle.setStatus("FINISHED");
                battle.setWinningTeamId(opponentTeamId);
                if (opponentEntry != null) {
                        battle.setWinnerId(opponentEntry.getUser().getId());
                }
                battle.setEndedAt(LocalDateTime.now());
                battleRepository.save(battle);
                
                participants.stream()
                        .filter(p -> p.getTeamId().equals(opponentTeamId))
                        .forEach(p -> coinService.awardCoins(p.getUser(), reward, "Battle victory (opponent timeout) #" + battleId));

                broadcastBattleStatus(battle);
                return battle;
        }

        public Battle getBattle(Long id) {
                Battle battle = battleRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Battle not found"));

                if (isBattleTimeExpired(battle)) {
                        return concludeBattleAsDraw(battle);
                }

                return battle;
        }

        public long getBattleRemainingSeconds(Battle battle) {
                if (battle == null || battle.getStartedAt() == null) {
                        return resolveBattleTimeLimitSeconds(battle);
                }

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        return 0;
                }

                int timeLimitSeconds = resolveBattleTimeLimitSeconds(battle);
                long elapsedSeconds = Duration.between(battle.getStartedAt(), LocalDateTime.now()).getSeconds();
                return Math.max(0, timeLimitSeconds - Math.max(0, elapsedSeconds));
        }

        public List<Battle> getAvailableBattles() {
                return battleRepository.findByStatus("WAITING");
        }

        public List<BattleParticipant> getBattleParticipants(Long battleId) {
                return participantRepository.findByBattleId(battleId);
        }

        private String normalizeLanguage(String languageInput) {
                if (languageInput == null || languageInput.isBlank()) {
                        return "PYTHON";
                }

                String value = languageInput.trim().toLowerCase();
                return switch (value) {
                        case "python", "py" -> "PYTHON";
                        case "javascript", "js", "node" -> "JAVASCRIPT";
                        case "java" -> "JAVA";
                        case "c" -> "C";
                        case "cpp", "c++" -> "CPP";
                        default -> "PYTHON";
                };
        }

        private int getBattleDurationSecondsByDifficulty(String difficultyInput) {
                if (difficultyInput == null || difficultyInput.isBlank()) {
                        return 600;
                }

                return switch (difficultyInput.trim().toLowerCase()) {
                        case "easy" -> 600;
                        case "medium" -> 1200;
                        case "hard" -> 1800;
                        default -> 600;
                };
        }

        private boolean isBattleTimeExpired(Battle battle) {
                if (battle == null || battle.getStartedAt() == null) {
                        return false;
                }

                if (!"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        return false;
                }

                int timeLimitSeconds = resolveBattleTimeLimitSeconds(battle);

                long elapsedSeconds = Duration.between(battle.getStartedAt(), LocalDateTime.now()).getSeconds();
                return elapsedSeconds >= timeLimitSeconds;
        }

        private int resolveBattleTimeLimitSeconds(Battle battle) {
                if (battle == null) {
                        return 600;
                }

                if (battle.getTimeLimitSeconds() != null && battle.getTimeLimitSeconds() > 0) {
                        return battle.getTimeLimitSeconds();
                }

                return getBattleDurationSecondsByDifficulty(
                                battle.getProblem() != null ? battle.getProblem().getDifficulty() : null);
        }

        private Battle concludeBattleAsDraw(Battle battle) {
                if (battle == null || !"ACTIVE".equalsIgnoreCase(battle.getStatus())) {
                        return battle;
                }

                battle.setStatus("FINISHED");
                battle.setWinnerId(null);
                battle.setWinningTeamId(null);
                battle.setEndedAt(LocalDateTime.now());
                battle = battleRepository.save(battle);
                
                // Refund entry fee to all active participants
                List<BattleParticipant> participants = participantRepository.findByBattleId(battle.getId());
                int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                
                for (var p : participants) {
                    coinService.awardCoins(p.getUser(), fee, "Battle Draw Refund #" + battle.getId());
                }

                broadcastBattleStatus(battle);
                return battle;
        }

        private boolean evaluateBattleSubmission(Problem problem, String userCode, String language) {
                List<ProblemService.TestCaseData> testCases = problemService.parseTestCases(problem);

                if (testCases.isEmpty()) {
                        DockerSandboxService.ExecutionResult result = dockerSandboxService.execute(userCode, language,
                                        "");
                        if (result.isTimedOut() || result.getExitCode() != 0) {
                                return false;
                        }
                        return normalizeOutput(result.getStdout()).equals(normalizeOutput(problem.getExpectedOutput()));
                }

                for (ProblemService.TestCaseData testCase : testCases) {
                        String normalizedInput = normalizeInputData(testCase.input());
                        DockerSandboxService.ExecutionResult result = dockerSandboxService.execute(userCode, language,
                                        normalizedInput);
                        if (result.isTimedOut() || result.getExitCode() != 0) {
                                return false;
                        }

                        String actual = normalizeOutput(result.getStdout());
                        String expected = normalizeOutput(testCase.expected());
                        if (!actual.equals(expected)) {
                                return false;
                        }
                }

                return true;
        }

        private DockerSandboxService.ExecutionResult runBattleCode(Problem problem, String userCode, String language,
                        String selectedInputData) {
                if (selectedInputData != null && !selectedInputData.isBlank()) {
                        return dockerSandboxService.execute(userCode, language, normalizeInputData(selectedInputData));
                }

                List<ProblemService.TestCaseData> testCases = problemService.parseTestCases(problem);
                if (testCases.isEmpty()) {
                        return dockerSandboxService.execute(userCode, language, "");
                }

                return dockerSandboxService.execute(userCode, language, normalizeInputData(testCases.get(0).input()));
        }

        /**
         * Converts JSON-style inputs to standard CP stdin format.
         * e.g., "[1,2,3,4]" → "4\n1 2 3 4"
         * "[1,2]\n9" → "2\n1 2\n9"
         * "hello" → "hello"
         */
        private String normalizeInputData(String raw) {
                if (raw == null || raw.trim().isEmpty())
                        return "";
                String[] lines = raw.split("\n");
                StringBuilder result = new StringBuilder();

                for (String line : lines) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty())
                                continue;

                        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                                // Parse JSON-style array
                                try {
                                        String inner = trimmed.substring(1, trimmed.length() - 1).trim();
                                        if (inner.isEmpty()) {
                                                if (result.length() > 0)
                                                        result.append("\n");
                                                result.append("0");
                                                continue;
                                        }

                                        // Check for nested arrays (2D)
                                        if (inner.startsWith("[")) {
                                                // 2D array: parse sub-arrays
                                                java.util.List<String> subArrays = new java.util.ArrayList<>();
                                                int depth = 0;
                                                int start = 0;
                                                for (int i = 0; i < inner.length(); i++) {
                                                        char c = inner.charAt(i);
                                                        if (c == '[')
                                                                depth++;
                                                        else if (c == ']') {
                                                                depth--;
                                                                if (depth == 0) {
                                                                        subArrays.add(inner.substring(start, i + 1)
                                                                                        .trim());
                                                                        // Skip comma
                                                                        start = i + 1;
                                                                        while (start < inner.length() && (inner
                                                                                        .charAt(start) == ','
                                                                                        || inner.charAt(start) == ' '))
                                                                                start++;
                                                                }
                                                        }
                                                }

                                                if (result.length() > 0)
                                                        result.append("\n");
                                                result.append(subArrays.size());
                                                for (String sub : subArrays) {
                                                        String subInner = sub.substring(1, sub.length() - 1).trim();
                                                        String[] elements = subInner.split("\\s*,\\s*");
                                                        result.append("\n").append(elements.length);
                                                        result.append("\n").append(String.join(" ", elements));
                                                }
                                        } else {
                                                // 1D array
                                                String[] elements = inner.split("\\s*,\\s*");
                                                if (result.length() > 0)
                                                        result.append("\n");
                                                result.append(elements.length);
                                                result.append("\n").append(String.join(" ", elements));
                                        }
                                } catch (Exception e) {
                                        // Fallback: pass as-is
                                        if (result.length() > 0)
                                                result.append("\n");
                                        result.append(trimmed);
                                }
                        } else {
                                // Plain value
                                if (result.length() > 0)
                                        result.append("\n");
                                result.append(trimmed);
                        }
                }

                return result.toString();
        }

        private String normalizeOutput(String value) {
                return safe(value).replace("\r\n", "\n").trim();
        }

        private String safe(String value) {
                return value == null ? "" : value;
        }

        private String cleanRunnerWarning(String stderr) {
                String text = safe(stderr);
                String warning = "Docker not available. Executed using local fallback runner.";
                if (text.startsWith(warning)) {
                        text = text.substring(warning.length()).trim();
                }
                return text;
        }

        @Transactional
        public void cancelMatchSearch(String username) {
                User user = userRepository.findByUsername(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                queueRepository.deleteByUser(user);

                // Check if user is in a WAITING 2v2 battle
                Optional<BattleParticipant> participant = participantRepository
                        .findTopByUserIdOrderByBattleIdDesc(user.getId());
                
                if (participant.isPresent()) {
                    Battle battle = participant.get().getBattle();
                    if ("WAITING".equals(battle.getStatus()) && "2v2".equals(battle.getMode())) {
                        // Notify all participants of cancellation and refund
                        List<BattleParticipant> members = getBattleParticipants(battle.getId());
                        int fee = getEntryFeeByDifficulty(battle.getProblem().getDifficulty());
                        
                        for (var m : members) {
                            coinService.awardCoins(m.getUser(), fee, "2v2 Recruitment Aborted Refund #" + battle.getId());
                            messagingTemplate.convertAndSend("/topic/notifications/" + m.getUser().getUsername(),
                                Map.of(
                                    "type", "BATTLE_CANCELLED",
                                    "message", "2v2 Recruitment aborted. Fee refunded."
                                )
                            );
                        }
                        // Delete the battle and its participants
                        participantRepository.deleteAll(members);
                        battleRepository.delete(battle);
                    }
                }
        }

}
