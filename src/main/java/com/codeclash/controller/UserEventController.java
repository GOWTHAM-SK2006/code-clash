package com.codeclash.controller;

import com.codeclash.entity.Event;
import com.codeclash.service.EventService;
import com.codeclash.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class UserEventController {

    private final EventService eventService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public List<Map<String, Object>> getActiveEvents(
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String username = resolveUsername(authentication, authHeader);
        return eventService.getAllEvents(true).stream()
                .map(e -> eventService.getEventStatus(e.getId(), username))
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public Map<String, Object> getEventStatus(
            @PathVariable String id,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String username = resolveUsername(authentication, authHeader);
        return eventService.getEventStatus(id, username);
    }

    @PostMapping("/{id}/bid")
    public Map<String, Object> placeBid(
            @PathVariable String id,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String username = resolveUsername(authentication, authHeader);
        if (username == null) {
            throw new RuntimeException("Authentication required to place bid");
        }
        return eventService.placeBid(id, username);
    }

    @PostMapping("/{id}/disqualify")
    public Map<String, Object> disqualify(
            @PathVariable String id,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String username = resolveUsername(authentication, authHeader);
        if (username == null) {
            throw new RuntimeException("Authentication required");
        }
        eventService.disqualifyUser(id, username);
        return Map.of("ok", true);
    }

    private String resolveUsername(Authentication authentication, String authHeader) {
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtUtil.validateToken(token)) {
                try {
                    return jwtUtil.extractUsername(token);
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}
