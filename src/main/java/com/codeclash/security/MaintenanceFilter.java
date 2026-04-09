package com.codeclash.security;

import com.codeclash.service.AdminPanelService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class MaintenanceFilter extends OncePerRequestFilter {

    private final AdminPanelService adminPanelService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();

        Map<String, Object> settings = adminPanelService.getSettings();
        Map<String, Object> platform = (Map<String, Object>) settings.get("platform");
        boolean maintenanceMode = false;
        if (platform != null) {
            maintenanceMode = (boolean) platform.getOrDefault("maintenanceMode", false);
        }

        if (maintenanceMode) {
            boolean isAdminPath = uri.startsWith("/admin-dashboard.html") ||
                    uri.startsWith("/api/admin/") ||
                    uri.startsWith("/api/auth/login");
            boolean isStaticAsset = uri.startsWith("/css/") || uri.startsWith("/js/") || uri.startsWith("/images/");
            boolean isMaintenancePage = uri.equals("/maintenance.html");
            boolean isHealthCheck = uri.equals("/") || uri.equals("/actuator/health") || uri.equals("/health");

            if (!isAdminPath && !isStaticAsset && !isMaintenancePage && !isHealthCheck) {
                response.sendRedirect("/maintenance.html");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
