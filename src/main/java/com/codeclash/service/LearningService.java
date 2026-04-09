package com.codeclash.service;

import com.codeclash.entity.Language;
import com.codeclash.entity.Lesson;
import com.codeclash.entity.Topic;
import com.codeclash.repository.LanguageRepository;
import com.codeclash.repository.LessonRepository;
import com.codeclash.repository.TopicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LearningService {

    private final LanguageRepository languageRepository;
    private final TopicRepository topicRepository;
    private final LessonRepository lessonRepository;

    public List<Language> getAllLanguages() {
        return languageRepository.findByEnabledTrue();
    }

    public List<Language> adminGetAllLanguages() {
        return languageRepository.findAll();
    }

    @Transactional
    public void toggleLanguageStatus(Long id, boolean enabled) {
        Language lang = languageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Language not found"));
        lang.setEnabled(enabled);
        languageRepository.save(lang);
    }

    public List<Topic> getTopicsByLanguage(Long languageId) {
        return topicRepository.findByLanguageIdOrderByOrderIndex(languageId);
    }

    public List<Lesson> getLessonsByTopic(Long topicId) {
        return lessonRepository.findByTopicIdOrderByOrderIndex(topicId);
    }

    public Lesson getLesson(Long id) {
        return lessonRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Lesson not found"));
    }

    @Transactional
    public void clearAllLearningContent() {
        lessonRepository.deleteAll();
        topicRepository.deleteAll();
    }

}

