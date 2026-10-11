package com.codeclash.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.*;

class DataSourceConfigTest {

    @Test
    @DisplayName("Should correctly parse Supabase session pooler URI")
    void shouldParseSupabaseSessionPoolerUri() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL", "postgresql://postgres.oytuknmfaofjlocdzgdi:MySecretPass123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres");

        DataSourceConfig.DatabaseConnectionDetails details = DataSourceConfig.resolveConnectionDetails(env);

        assertNotNull(details);
        assertEquals("jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require", details.jdbcUrl());
        assertEquals("postgres.oytuknmfaofjlocdzgdi", details.username());
        assertEquals("MySecretPass123", details.password());
    }

    @Test
    @DisplayName("Should correctly parse postgres:// URI with custom port")
    void shouldParsePostgresSchemeWithCustomPort() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL", "postgres://postgres.oytuknmfaofjlocdzgdi:ComplexPass@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres");

        DataSourceConfig.DatabaseConnectionDetails details = DataSourceConfig.resolveConnectionDetails(env);

        assertNotNull(details);
        assertEquals("jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0", details.jdbcUrl());
        assertEquals("postgres.oytuknmfaofjlocdzgdi", details.username());
        assertEquals("ComplexPass", details.password());
    }

    @Test
    @DisplayName("Should correctly parse URI with percent-encoded special characters in password")
    void shouldParseUriWithEncodedCharactersInPassword() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL", "postgresql://postgres.oytuknmfaofjlocdzgdi:p%40ssword%21@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres");

        DataSourceConfig.DatabaseConnectionDetails details = DataSourceConfig.resolveConnectionDetails(env);

        assertNotNull(details);
        assertEquals("jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require", details.jdbcUrl());
        assertEquals("postgres.oytuknmfaofjlocdzgdi", details.username());
        assertEquals("p@ssword!", details.password());
    }

    @Test
    @DisplayName("Should correctly parse discrete PG* environment variables")
    void shouldParseDiscreteEnvironmentVariables() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("PGHOST", "aws-0-ap-northeast-2.pooler.supabase.com");
        env.setProperty("PGPORT", "5432");
        env.setProperty("PGDATABASE", "postgres");
        env.setProperty("PGUSER", "postgres.oytuknmfaofjlocdzgdi");
        env.setProperty("PGPASSWORD", "MySecretPass123");
        env.setProperty("PGSSLMODE", "require");

        DataSourceConfig.DatabaseConnectionDetails details = DataSourceConfig.resolveConnectionDetails(env);

        assertNotNull(details);
        assertEquals("jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require", details.jdbcUrl());
        assertEquals("postgres.oytuknmfaofjlocdzgdi", details.username());
        assertEquals("MySecretPass123", details.password());
    }

    @Test
    @DisplayName("Should correctly handle direct JDBC URL and separate credentials")
    void shouldHandleDirectJdbcUrl() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("SPRING_DATASOURCE_URL", "jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require");
        env.setProperty("SPRING_DATASOURCE_USERNAME", "postgres.oytuknmfaofjlocdzgdi");
        env.setProperty("SPRING_DATASOURCE_PASSWORD", "Secret123");

        DataSourceConfig.DatabaseConnectionDetails details = DataSourceConfig.resolveConnectionDetails(env);

        assertNotNull(details);
        assertEquals("jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require", details.jdbcUrl());
        assertEquals("postgres.oytuknmfaofjlocdzgdi", details.username());
        assertEquals("Secret123", details.password());
    }

    @Test
    @DisplayName("Should throw clear exception when no database configuration is provided in production")
    void shouldThrowExceptionWhenNoDatabaseConfigurationProvided() {
        MockEnvironment env = new MockEnvironment();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                DataSourceConfig.resolveConnectionDetails(env)
        );

        assertTrue(ex.getMessage().contains("PostgreSQL database connection configuration is missing"));
        assertTrue(ex.getMessage().contains("DATABASE_URL"));
    }

    @Test
    @DisplayName("Should sanitize passwords in JDBC logging output")
    void shouldSanitizePasswordsInLogging() {
        String urlWithPass = "jdbc:postgresql://host:5432/db?user=admin&password=secretPassword123&sslmode=require";
        String sanitized = DataSourceConfig.sanitizeJdbcUrl(urlWithPass);

        assertFalse(sanitized.contains("secretPassword123"));
        assertTrue(sanitized.contains("password=*****"));
    }
}
