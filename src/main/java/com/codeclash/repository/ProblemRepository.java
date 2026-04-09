package com.codeclash.repository;

import com.codeclash.entity.Problem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProblemRepository extends JpaRepository<Problem, Long> {
    List<Problem> findByDifficulty(String difficulty);

    List<Problem> findByCategory(String category);
}
