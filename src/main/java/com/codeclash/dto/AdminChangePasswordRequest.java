package com.codeclash.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminChangePasswordRequest {
    private String currentPassword;
    private String newPassword;
}
