package com.codeclash.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String title;

    // Bidding Phase
    private String biddingTitle;
    private int entryFee;
    private LocalDateTime biddingStartTime;
    // Bidding duration is fixed 10 mins

    // Contest Phase
    private String contestTitle;
    private LocalDateTime contestStartTime;
    private int contestDurationMinutes;
    private String problemIds; // comma-separated

    // Selection Settings
    private int maxParticipants;

    @Builder.Default
    private boolean active = true;

    @Builder.Default
    private boolean biddingProcessed = false;

    @Builder.Default
    private boolean contestProcessed = false;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
