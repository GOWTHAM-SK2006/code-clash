package com.codeclash.repository;

import com.codeclash.entity.Language;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface LanguageRepository extends JpaRepository<Language, Long> {
    Optional<Language> findBySlug(String slug);
    List<Language> findByEnabledTrue();
}
