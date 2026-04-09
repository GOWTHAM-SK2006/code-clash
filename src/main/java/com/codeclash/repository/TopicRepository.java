package com.codeclash.repository;

import com.codeclash.entity.Topic;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TopicRepository extends JpaRepository<Topic, Long> {
    List<Topic> findByLanguageIdOrderByOrderIndex(Long languageId);
}
