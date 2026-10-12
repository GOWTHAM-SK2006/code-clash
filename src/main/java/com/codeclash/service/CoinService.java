package com.codeclash.service;

import com.codeclash.entity.CoinTransaction;
import com.codeclash.entity.User;
import com.codeclash.repository.CoinTransactionRepository;
import com.codeclash.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CoinService {

    private final CoinTransactionRepository coinTransactionRepository;
    private final UserRepository userRepository;

    @Transactional
    public void awardCoins(User user, int amount, String reason) {
        int current = user.getCoins() != null ? user.getCoins() : 0;
        user.setCoins(current + amount);
        userRepository.save(user);

        CoinTransaction tx = CoinTransaction.builder()
                .user(user)
                .amount(amount)
                .reason(reason)
                .build();
        coinTransactionRepository.save(tx);
    }

    @Transactional
    public void spendCoins(User user, int amount, String reason) {
        if (amount <= 0) {
            throw new RuntimeException("Invalid coin amount");
        }

        int current = user.getCoins() != null ? user.getCoins() : 0;
        if (current < amount) {
            throw new RuntimeException("Insufficient coins");
        }

        user.setCoins(current - amount);
        userRepository.save(user);

        CoinTransaction tx = CoinTransaction.builder()
                .user(user)
                .amount(-amount)
                .reason(reason)
                .build();
        coinTransactionRepository.save(tx);
    }

    public boolean hasEnoughCoins(User user, int amount) {
        return user != null && user.getCoins() != null && user.getCoins() >= amount;
    }

    @Transactional(readOnly = true)
    public List<CoinTransaction> getHistory(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return coinTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    @Transactional(readOnly = true)
    public int getBalance(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getCoins() != null ? user.getCoins() : 0;
    }
}
