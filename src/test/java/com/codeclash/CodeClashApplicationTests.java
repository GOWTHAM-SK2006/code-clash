package com.codeclash;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class CodeClashApplicationTests {

    @Test
    void contextLoads() {
        // Verifies complete Spring Boot context, JPA repositories, and beans initialize successfully
    }
}
