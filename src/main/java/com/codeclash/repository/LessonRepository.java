package com.codeclash.repository;

import com.codeclash.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LessonRepository extends JpaRepository<Lesson, Long> {
    List<Lesson> findByTopicIdOrderByOrderIndex(Long topicId);
}
