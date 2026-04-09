package com.codeclash.controller;

import com.codeclash.dto.SubmissionRequest;
import com.codeclash.entity.User;
import com.codeclash.service.SubmissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @PostMapping
    public ResponseEntity<?> submit(Authentication auth, @RequestBody SubmissionRequest request) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(submissionService.submitCode(user.getUsername(), request));
    }

    @GetMapping
    public ResponseEntity<?> getMySubmissions(Authentication auth) {
        User user = (User) auth.getPrincipal();
        return ResponseEntity.ok(submissionService.getUserSubmissions(user.getUsername()));
    }
}
