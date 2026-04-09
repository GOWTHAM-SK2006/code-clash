package com.codeclash.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "problems")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Problem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(nullable = false, length = 20)
    private String difficulty;

    @Column(columnDefinition = "TEXT")
    private String starterCode;

    @Column(columnDefinition = "TEXT")
    private String testCases;

    @Column(columnDefinition = "TEXT")
    private String expectedOutput;

    @Column(nullable = false)
    @Builder.Default
    private Integer points = 10;

    @Column(length = 100)
    private String category;

    @Column(columnDefinition = "TEXT")
    private String inputFormat;

    @Column(columnDefinition = "TEXT")
    private String outputFormat;

    @Column(columnDefinition = "TEXT")
    private String functionSignatures;

    // JSON config for LeetCode-style wrapper generation.
    // Format:
    // {"functionName":"twoSum","params":[{"name":"nums","type":"json"},{"name":"target","type":"int"}]}
    // Supported param types: json (list/dict), int, float, str, bool
    // If null/blank, falls back to stdin input() patching.
    @Column(columnDefinition = "TEXT")
    private String wrapperConfig;
}
