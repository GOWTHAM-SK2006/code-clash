package com.codeclash.controller;

import com.codeclash.service.ProblemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/problems")
@RequiredArgsConstructor
public class ProblemController {

    private final ProblemService problemService;

    @GetMapping
    public ResponseEntity<?> getAllProblems(@RequestParam(required = false) String difficulty) {
        if (difficulty != null && !difficulty.isEmpty()) {
            return ResponseEntity.ok(problemService.getProblemsByDifficulty(difficulty));
        }
        return ResponseEntity.ok(problemService.getAllProblems());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getProblem(@PathVariable Long id) {
        return ResponseEntity.ok(problemService.getProblemById(id));
    }
}
