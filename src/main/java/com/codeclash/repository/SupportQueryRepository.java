package com.codeclash.repository;

import com.codeclash.entity.SupportQuery;
import com.codeclash.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SupportQueryRepository extends JpaRepository<SupportQuery, Long> {
    List<SupportQuery> findByUserOrderByUpdatedAtDesc(User user);
    List<SupportQuery> findAllByOrderByUpdatedAtDesc();
    
    void deleteByUserId(Long userId);
}
