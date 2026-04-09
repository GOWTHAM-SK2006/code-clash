package com.codeclash.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BattleSubmitRequest {
    private String code;
    private String language;
    private String inputData;
}
