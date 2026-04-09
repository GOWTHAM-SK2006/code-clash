package com.codeclash.controller;

import com.codeclash.entity.Event;
import com.codeclash.service.AdminPanelService;
import com.codeclash.service.EventService;
import com.codeclash.util.StringUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/events")
@RequiredArgsConstructor
public class AdminEventController {

    private final EventService eventService;
    private final AdminPanelService adminPanelService;

    @GetMapping
    public List<Event> getAllEvents(@RequestHeader("X-Admin-Session") String token) {
        adminPanelService.verifyAdminSession(token);
        return eventService.getAllEvents(false);
    }

    @PostMapping
    public Event createEvent(@RequestHeader("X-Admin-Session") String token, @RequestBody Map<String, Object> body) {
        adminPanelService.verifyAdminSession(token);

        Event event = Event.builder()
                .title(String.valueOf(body.get("title")))
                .biddingTitle(String.valueOf(body.get("biddingTitle")))
                .entryFee(Integer.parseInt(String.valueOf(body.get("entryFee"))))
                .biddingStartTime(LocalDateTime.parse(String.valueOf(body.get("biddingStartTime"))))
                .contestTitle(String.valueOf(body.get("contestTitle")))
                .contestStartTime(LocalDateTime.parse(String.valueOf(body.get("contestStartTime"))))
                .contestDurationMinutes(Integer.parseInt(String.valueOf(body.get("contestDuration"))))
                .problemIds(String.join(",", StringUtil.parseStringList(body.get("problemIds"))))
                .maxParticipants(Integer.parseInt(String.valueOf(body.get("maxParticipants"))))
                .active(true)
                .build();

        return eventService.createEvent(event);
    }

    @DeleteMapping("/{id}")
    public void deleteEvent(@RequestHeader("X-Admin-Session") String token, @PathVariable String id) {
        adminPanelService.verifyAdminSession(token);
        eventService.deleteEvent(id);
    }

    @GetMapping("/{id}/details")
    public Map<String, Object> getEventDetails(@RequestHeader("X-Admin-Session") String token,
            @PathVariable String id) {
        adminPanelService.verifyAdminSession(token);
        return eventService.getAdminEventDetails(id);
    }

    @PutMapping("/{id}")
    public Event updateEvent(@RequestHeader("X-Admin-Session") String token, @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        adminPanelService.verifyAdminSession(token);
        return eventService.updateEvent(id, body);
    }

    @PostMapping("/{id}/finalize")
    public Map<String, Object> finalizeBidding(@RequestHeader("X-Admin-Session") String token, @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        adminPanelService.verifyAdminSession(token);
        @SuppressWarnings("unchecked")
        List<Long> winnerIds = (List<Long>) body.get("winnerIds");
        eventService.manualFinalizeWinners(id, winnerIds);
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/distribute")
    public Map<String, Object> distributeRewards(@RequestHeader("X-Admin-Session") String token,
            @PathVariable String id, @RequestBody Map<String, Object> body) {
        adminPanelService.verifyAdminSession(token);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> customRewards = (List<Map<String, Object>>) body.get("rewards");
        eventService.distributeRewards(id, customRewards);
        return Map.of("ok", true);
    }
}
