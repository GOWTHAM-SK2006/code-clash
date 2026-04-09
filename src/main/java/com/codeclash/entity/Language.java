package com.codeclash.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "languages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
public class Language {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String name;

    @Column(unique = true, nullable = false, length = 50)
    private String slug;

    @Column(length = 20)
    private String icon;

    @Column(length = 7)
    private String color;

    @Builder.Default
    @Column(nullable = false)
    private boolean enabled = true;
}
