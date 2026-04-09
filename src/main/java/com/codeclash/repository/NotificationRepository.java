package com.codeclash.repository;

import com.codeclash.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUser_IdOrderByCreatedAtDesc(Long userId);

    long countByUser_IdAndReadFalse(Long userId);

    List<Notification> findByUser_IdAndReadFalse(Long userId);

    void deleteByUser_Id(Long userId);
}
