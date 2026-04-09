package com.codeclash.repository;

import com.codeclash.entity.QueryMessage;
import com.codeclash.entity.SupportQuery;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface QueryMessageRepository extends JpaRepository<QueryMessage, Long> {
    List<QueryMessage> findByQueryOrderByCreatedAtAsc(SupportQuery query);
    
    void deleteBySenderId(Long userId);
    
    void deleteByQueryUserId(Long userId);
}
