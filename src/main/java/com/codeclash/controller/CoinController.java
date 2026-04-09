package com.codeclash.controller;

import com.codeclash.entity.User;
import com.codeclash.service.CoinService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/coins")
@RequiredArgsConstructor
public class CoinController {

    private final CoinService coinService;

    @GetMapping("/balance")
    public ResponseEntity<?> getBalance(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(Map.of("balance", coinService.getBalance(user.getUsername())));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(coinService.getHistory(user.getUsername()));
    }
}
