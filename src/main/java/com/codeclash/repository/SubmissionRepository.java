package com.codeclash.repository;

import com.codeclash.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    List<Submission> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Submission> findByUserIdAndProblemId(Long userId, Long problemId);

    long countByUserIdAndStatus(Long userId, String status);

    void deleteByUserId(Long userId);
}
