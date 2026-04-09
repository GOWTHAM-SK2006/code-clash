package com.codeclash.controller;

import com.codeclash.entity.Notification;
import com.codeclash.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public List<Notification> getNotifications(Authentication auth) {
        return notificationService.getNotifications(auth.getName());
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(Authentication auth) {
        return Map.of("count", notificationService.getUnreadCount(auth.getName()));
    }

    @PostMapping("/mark-read")
    public Map<String, Boolean> markAllRead(Authentication auth) {
        notificationService.markAllRead(auth.getName());
        return Map.of("ok", true);
    }
}
