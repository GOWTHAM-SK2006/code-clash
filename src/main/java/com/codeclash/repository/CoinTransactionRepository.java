package com.codeclash.repository;

import com.codeclash.entity.CoinTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CoinTransactionRepository extends JpaRepository<CoinTransaction, Long> {
    List<CoinTransaction> findByUserIdOrderByCreatedAtDesc(Long userId);

    void deleteByUserId(Long userId);
}
