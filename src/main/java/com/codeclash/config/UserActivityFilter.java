package com.codeclash.config;

import com.codeclash.entity.User;
import com.codeclash.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class UserActivityFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            String username = auth.getName();
            // Update last active time periodically (not every single request to save DB load)
            // But for this simple implementation, once per request is fine or we can add a check
            userRepository.findByUsername(username).ifPresent(user -> {
                LocalDateTime now = LocalDateTime.now();
                if (user.getLastActiveAt() == null || user.getLastActiveAt().isBefore(now.minusSeconds(30))) {
                    user.setLastActiveAt(now);
                    userRepository.save(user);
                }
            });
        }

        filterChain.doFilter(request, response);
    }
}
