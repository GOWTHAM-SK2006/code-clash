package com.codeclash.controller;

import com.codeclash.service.LearningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learningService;

    @GetMapping("/languages")
    public ResponseEntity<?> getLanguages() {
        return ResponseEntity.ok(learningService.getAllLanguages());
    }

    @GetMapping("/topics")
    public ResponseEntity<?> getTopics(@RequestParam Long languageId) {
        return ResponseEntity.ok(learningService.getTopicsByLanguage(languageId));
    }

    @GetMapping("/lessons")
    public ResponseEntity<?> getLessons(@RequestParam Long topicId) {
        return ResponseEntity.ok(learningService.getLessonsByTopic(topicId));
    }

    @GetMapping("/lessons/{id}")
    public ResponseEntity<?> getLesson(@PathVariable Long id) {
        return ResponseEntity.ok(learningService.getLesson(id));
    }
}
