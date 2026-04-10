package com.codeclash.controller;

import com.codeclash.entity.User;
import com.codeclash.service.UserService;
import com.codeclash.service.CoinService;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/store")
@RequiredArgsConstructor
public class StoreController {

    private final UserService userService;
    private final CoinService coinService;
    private final UserRepository userRepository;

    @GetMapping("/items")
    public ResponseEntity<?> getStoreItems(Authentication auth) {
        User user = (User) auth.getPrincipal();
        // Refresh user to get latest characters
        User freshUser = userService.getUserByUsername(user.getUsername());
        Set<String> owned = freshUser.getOwnedCharacters();

        List<Map<String, Object>> items = new ArrayList<>();
        
        items.add(createItem("input_master", "Input Master ⚡", "Automatically provides input (no need to type input() code)", 5000, owned.contains("input_master")));
        items.add(createItem("vision_hacker", "Vision Hacker 👁️", "Reveals all 15 test cases for 10 seconds in battle", 3500, owned.contains("vision_hacker")));
        items.add(createItem("time_bender", "Time Bender ⏳", "Adds +2 minutes to battle time when activated", 3000, owned.contains("time_bender")));
        items.add(createItem("coin_booster", "Coin Booster 💰", "Increases coins earned per battle permanently", 3000, owned.contains("coin_booster")));

        return ResponseEntity.ok(items);
    }

    @PostMapping("/buy/{itemId}")
    public ResponseEntity<?> buyItem(Authentication auth, @PathVariable String itemId) {
        try {
            User user = (User) auth.getPrincipal();
            User freshUser = userService.getUserByUsername(user.getUsername());

            if (freshUser.getOwnedCharacters().contains(itemId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "You already own this character"));
            }

            int price = getItemPrice(itemId);
            if (price < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid item ID"));
            }

            if (!coinService.hasEnoughCoins(freshUser, price)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Insufficient coins! You need " + price + " coins."));
            }

            coinService.spendCoins(freshUser, price, "Purchased Character: " + itemId);
            freshUser.getOwnedCharacters().add(itemId);
            userRepository.save(freshUser);

            return ResponseEntity.ok(Map.of("message", "Character unlocked successfully!", "itemId", itemId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Map<String, Object> createItem(String id, String name, String desc, int price, boolean owned) {
        return Map.of(
            "id", id,
            "name", name,
            "description", desc,
            "price", price,
            "owned", owned
        );
    }

    private int getItemPrice(String itemId) {
        switch (itemId) {
            case "input_master": return 5000;
            case "vision_hacker": return 3500;
            case "time_bender": return 3000;
            case "coin_booster": return 3000;
            default: return -1;
        }
    }
}
