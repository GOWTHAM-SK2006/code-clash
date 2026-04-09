package com.codeclash.controller;

import com.codeclash.dto.QueryReplyRequest;
import com.codeclash.dto.SupportQueryRequest;
import com.codeclash.entity.User;
import com.codeclash.service.SupportQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/queries")
@RequiredArgsConstructor
public class SupportQueryController {

    private final SupportQueryService queryService;

    @PostMapping
    public ResponseEntity<?> createQuery(Authentication auth, @RequestBody SupportQueryRequest request) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(queryService.createQuery(user, request.getSubject(), request.getContent()));
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyQueries(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(queryService.getMyQueries(user));
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<?> getMessages(Authentication auth, @PathVariable Long id) {
        User user = (User) auth.getPrincipal();
        try {
            return ResponseEntity.ok(queryService.getMessages(id, user));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<?> reply(Authentication auth, @PathVariable Long id, @RequestBody QueryReplyRequest request) {
        User user = (User) auth.getPrincipal();
        try {
            return ResponseEntity.ok(queryService.addMessage(id, user, request.getContent()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }
}
