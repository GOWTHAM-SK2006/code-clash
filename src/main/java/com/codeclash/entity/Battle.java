package com.codeclash.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "battles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Battle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "problem_id", nullable = false)
    private Problem problem;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "WAITING";

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String mode = "1v1"; // "1v1" or "2v2"

    @Column
    private Long winnerId;

    @Column
    @Builder.Default
    private LocalDateTime startedAt = LocalDateTime.now();

    @Column
    private LocalDateTime endedAt;

    @Column(nullable = false)
    @Builder.Default
    private Integer timeLimitSeconds = 900;
}
