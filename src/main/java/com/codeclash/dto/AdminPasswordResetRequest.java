package com.codeclash.dto;

public class AdminPasswordResetRequest {
    private String adminPassword;

    public AdminPasswordResetRequest() {}

    public AdminPasswordResetRequest(String adminPassword) {
        this.adminPassword = adminPassword;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
