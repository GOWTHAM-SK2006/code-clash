package com.codeclash.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionResponse {
    private Long id;
    private Long problemId;
    private String problemTitle;
    private String code;
    private String language;
    private String status;
    private String output;
    private LocalDateTime createdAt;
}
