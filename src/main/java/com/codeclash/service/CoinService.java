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
        user.setCoins(user.getCoins() + amount);
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

        if (user.getCoins() < amount) {
            throw new RuntimeException("Insufficient coins");
        }

        user.setCoins(user.getCoins() - amount);
        userRepository.save(user);

        CoinTransaction tx = CoinTransaction.builder()
                .user(user)
                .amount(-amount)
                .reason(reason)
                .build();
        coinTransactionRepository.save(tx);
    }

    public boolean hasEnoughCoins(User user, int amount) {
        return user.getCoins() != null && user.getCoins() >= amount;
    }

    public List<CoinTransaction> getHistory(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return coinTransactionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    public int getBalance(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getCoins();
    }
}
