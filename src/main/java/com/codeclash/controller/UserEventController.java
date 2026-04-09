package com.codeclash.controller;

import com.codeclash.entity.Event;
import com.codeclash.service.EventService;
import com.codeclash.security.JwtUtil;
import lombok.RequiredArgsConstructor;
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
            @RequestHeader(value = "Authorization", required = false) String auth) {
        String username = (auth != null && auth.startsWith("Bearer ")) ? jwtUtil.extractUsername(auth.substring(7))
                : null;
        return eventService.getAllEvents(true).stream()
                .map(e -> eventService.getEventStatus(e.getId(), username))
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public Map<String, Object> getEventStatus(@PathVariable String id,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        String username = (auth != null && auth.startsWith("Bearer ")) ? jwtUtil.extractUsername(auth.substring(7))
                : null;
        return eventService.getEventStatus(id, username);
    }

    @PostMapping("/{id}/bid")
    public Map<String, Object> placeBid(@PathVariable String id, @RequestHeader("Authorization") String auth) {
        String username = jwtUtil.extractUsername(auth.substring(7));
        return eventService.placeBid(id, username);
    }

    @PostMapping("/{id}/disqualify")
    public Map<String, Object> disqualify(@PathVariable String id, @RequestHeader("Authorization") String auth) {
        String username = jwtUtil.extractUsername(auth.substring(7));
        eventService.disqualifyUser(id, username);
        return Map.of("ok", true);
    }
}
