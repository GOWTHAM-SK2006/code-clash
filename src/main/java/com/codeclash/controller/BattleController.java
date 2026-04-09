package com.codeclash.controller;

import com.codeclash.dto.*;
import com.codeclash.service.BattleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/battles")
@RequiredArgsConstructor
public class BattleController {

    private final BattleService battleService;

    @PostMapping("/find")
    public ResponseEntity<?> findMatch(Authentication auth,
            @RequestBody(required = false) Map<String, String> request) {
        String username = auth.getName();
        String difficulty = request != null ? request.get("difficulty") : null;
        try {
            return ResponseEntity.ok(battleService.findMatch(username, difficulty));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @GetMapping("/my-active")
    public ResponseEntity<?> getMyActiveBattle(Authentication auth) {
        String username = auth.getName();
        return battleService.getActiveBattleForUser(username)
                .map(battle -> {
                    // Find opponent name
                    String opponentName = "Opponent";
                    var participants = battleService.getBattleParticipants(battle.getId());
                    for (var p : participants) {
                        if (!p.getUser().getUsername().equals(username)) {
                            opponentName = p.getUser().getDisplayName();
                            break;
                        }
                    }
                    return ResponseEntity.ok(Map.of(
                            "status", "matched",
                            "battleId", battle.getId(),
                            "opponentName", opponentName,
                            "problemName", battle.getProblem() != null ? battle.getProblem().getTitle() : "Unknown"));
                })
                .orElse(ResponseEntity.ok(Map.of("status", "none")));
    }

    @PostMapping("/create")
    public ResponseEntity<?> createBattle(Authentication auth, @RequestBody BattleRequest request) {
        String username = auth.getName();
        return ResponseEntity.ok(battleService.createBattle(username, request));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> joinBattle(@PathVariable Long id, Authentication auth) {
        try {
            String username = auth.getName();
            return ResponseEntity.ok(battleService.joinBattle(id, username));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @PostMapping("/invite-team")
    public ResponseEntity<?> inviteTeam(Authentication auth, @RequestBody Map<String, Object> request) {
        String username = auth.getName();
        Long friendId = ((Number) request.get("friendId")).longValue();
        String difficulty = (String) request.get("difficulty");
        try {
            return ResponseEntity.ok(battleService.sendBattleInvite(username, friendId, difficulty));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @PostMapping("/invites/{id}/accept")
    public ResponseEntity<?> acceptInvite(@PathVariable Long id, Authentication auth) {
        String username = auth.getName();
        try {
            return ResponseEntity.ok(battleService.acceptBattleInvite(username, id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    private String getSafeMessage(Exception exception) {
        String message = exception.getMessage();
        return (message == null || message.isBlank()) ? "Request failed" : message;
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submitSolution(@PathVariable Long id, Authentication auth,
            @RequestBody BattleSubmitRequest request) {
        String username = auth.getName();
        return ResponseEntity.ok(battleService.submitBattleSolution(id, username, request));
    }

    @PostMapping("/{id}/run")
    public ResponseEntity<?> runCode(@PathVariable Long id, Authentication auth,
            @RequestBody BattleSubmitRequest request) {
        String username = auth.getName();
        try {
            return ResponseEntity.ok(battleService.runBattleCode(id, username, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBattle(@PathVariable Long id, Authentication auth) {
        String username = auth.getName();
        try {
            return ResponseEntity.ok(battleService.cancelBattle(id, username));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @PostMapping("/{id}/timeout")
    public ResponseEntity<?> timeoutBattle(@PathVariable Long id, Authentication auth) {
        String username = auth.getName();
        try {
            return ResponseEntity.ok(battleService.timeoutBattle(id, username));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @PostMapping("/cancel-find")
    public ResponseEntity<?> cancelMatchSearch(Authentication auth) {
        String username = auth.getName();
        try {
            battleService.cancelMatchSearch(username);
            return ResponseEntity.ok(Map.of("status", "cancelled"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", getSafeMessage(e)));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getBattle(@PathVariable Long id) {
        var battle = battleService.getBattle(id);
        return ResponseEntity.ok(Map.of(
                "battle", battle,
                "participants", battleService.getBattleParticipants(id),
                "remainingSeconds", battleService.getBattleRemainingSeconds(battle)));
    }

    @GetMapping("/available")
    public ResponseEntity<?> getAvailableBattles() {
        return ResponseEntity.ok(battleService.getAvailableBattles());
    }
}
