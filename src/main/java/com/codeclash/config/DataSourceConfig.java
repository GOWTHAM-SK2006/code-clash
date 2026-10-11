package com.codeclash.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import javax.sql.DataSource;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Configuration
@Profile("!dev")
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    public record DatabaseConnectionDetails(
            String jdbcUrl,
            String username,
            String password
    ) {}

    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        log.info("Initializing production PostgreSQL DataSource for CodeClash...");

        DatabaseConnectionDetails details = resolveConnectionDetails(env);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(details.jdbcUrl());
        if (StringUtils.hasText(details.username())) {
            config.setUsername(details.username());
        }
        if (details.password() != null) {
            config.setPassword(details.password());
        }
        config.setDriverClassName("org.postgresql.Driver");
        config.setPoolName("CodeClashHikariPool");

        // Production pool tuning for Railway/Supabase/cloud containers
        int maxPoolSize = getIntProperty(env, "DB_POOL_SIZE", 10);
        int minIdle = getIntProperty(env, "DB_POOL_MIN_IDLE", 2);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
        config.setValidationTimeout(5000);

        if (details.jdbcUrl().contains(":6543") || details.jdbcUrl().contains("prepareThreshold=0")) {
            config.addDataSourceProperty("prepareThreshold", "0");
        }

        log.info("PostgreSQL DataSource configured with target: {}", sanitizeJdbcUrl(details.jdbcUrl()));
        log.info("PostgreSQL User: {}", details.username() != null ? details.username() : "(none)");

        return new HikariDataSource(config);
    }

    public static DatabaseConnectionDetails resolveConnectionDetails(Environment env) {
        // Priority 1: Check full connection URLs from environment or properties
        // Railway, Heroku, Supabase commonly provide DATABASE_URL, DATABASE_PUBLIC_URL, DATABASE_PRIVATE_URL
        String rawUrl = getFirstNonBlank(env,
                "SPRING_DATASOURCE_URL",
                "DATABASE_URL",
                "DATABASE_PUBLIC_URL",
                "DATABASE_PRIVATE_URL",
                "POSTGRES_URL",
                "JDBC_DATABASE_URL",
                "spring.datasource.url"
        );

        if (StringUtils.hasText(rawUrl)) {
            DatabaseConnectionDetails parsed = parseDatabaseUrl(rawUrl.trim(), env);
            if (parsed != null) {
                return parsed;
            }
        }

        // Priority 2: Check discrete connection parameters (PGHOST, etc.)
        String host = getFirstNonBlank(env, "PGHOST", "SPRING_DATASOURCE_HOST", "DB_HOST");
        if (StringUtils.hasText(host) && !host.trim().isEmpty()) {
            String port = getFirstNonBlankOrDefault(env, "5432", "PGPORT", "SPRING_DATASOURCE_PORT", "DB_PORT");
            String database = getFirstNonBlankOrDefault(env, "postgres", "PGDATABASE", "SPRING_DATASOURCE_DATABASE", "DB_NAME");
            String username = getFirstNonBlank(env, "PGUSER", "SPRING_DATASOURCE_USERNAME", "DB_USER", "DATABASE_USERNAME");
            String password = getFirstNonBlank(env, "PGPASSWORD", "SPRING_DATASOURCE_PASSWORD", "DB_PASSWORD", "DATABASE_PASSWORD");

            boolean isLocalhost = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
            String defaultSsl = isLocalhost ? "prefer" : "require";
            String sslMode = getFirstNonBlankOrDefault(env, defaultSsl, "PGSSLMODE", "DB_SSLMODE");

            String jdbcUrl = String.format("jdbc:postgresql://%s:%s/%s?sslmode=%s", host, port, database, sslMode);
            if ("6543".equals(port) && !jdbcUrl.contains("prepareThreshold=")) {
                jdbcUrl += "&prepareThreshold=0";
            }
            return new DatabaseConnectionDetails(jdbcUrl, username, password);
        }

        // Priority 3: Neither valid URL nor PGHOST was provided.
        // DO NOT silently fall back to localhost in production, which leads to "Connection to localhost:5432 refused".
        String errorMsg = """
                PostgreSQL database connection configuration is missing!
                Please configure the database connection in Railway using one of these options:
                  Option A (Recommended): Set DATABASE_URL with your Supabase or Railway PostgreSQL URI:
                    DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres
                  Option B: Set discrete environment variables:
                    PGHOST=<host>
                    PGPORT=5432
                    PGDATABASE=postgres
                    PGUSER=postgres.<project-ref>
                    PGPASSWORD=<password>
                    PGSSLMODE=require
                  Option C: Set Spring standard properties:
                    SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:5432/postgres?sslmode=require
                    SPRING_DATASOURCE_USERNAME=postgres.<project-ref>
                    SPRING_DATASOURCE_PASSWORD=<password>
                """;
        log.error(errorMsg);
        throw new IllegalStateException(errorMsg);
    }

    public static DatabaseConnectionDetails parseDatabaseUrl(String rawUrl, Environment env) {
        String trimmed = rawUrl.trim();

        // Reject incomplete/empty host URLs (e.g. jdbc:postgresql://:5432/postgres)
        if (trimmed.contains("//:") || trimmed.contains("///")) {
            return null;
        }

        if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
            return parseUriString(trimmed, env);
        }

        if (trimmed.startsWith("jdbc:postgresql://")) {
            return parseJdbcString(trimmed, env);
        }

        log.warn("Unrecognized database URL format: {}. Attempting fallback parsing.", sanitizeJdbcUrl(trimmed));
        return null;
    }

    private static DatabaseConnectionDetails parseUriString(String uriString, Environment env) {
        try {
            int schemeEnd = uriString.indexOf("://");
            if (schemeEnd == -1) {
                return null;
            }
            String afterScheme = uriString.substring(schemeEnd + 3);

            String userInfo = null;
            String hostPart = afterScheme;

            // Find last '@' before '/' to separate userInfo and host:port
            int slashIndex = afterScheme.indexOf('/');
            int atIndex = afterScheme.lastIndexOf('@');
            if (atIndex != -1 && (slashIndex == -1 || atIndex < slashIndex)) {
                userInfo = afterScheme.substring(0, atIndex);
                hostPart = afterScheme.substring(atIndex + 1);
            }

            String username = null;
            String password = null;
            if (userInfo != null) {
                int colonIndex = userInfo.indexOf(':');
                if (colonIndex != -1) {
                    username = URLDecoder.decode(userInfo.substring(0, colonIndex), StandardCharsets.UTF_8);
                    password = URLDecoder.decode(userInfo.substring(colonIndex + 1), StandardCharsets.UTF_8);
                } else {
                    username = URLDecoder.decode(userInfo, StandardCharsets.UTF_8);
                }
            }

            if (!StringUtils.hasText(username)) {
                username = getFirstNonBlank(env, "PGUSER", "SPRING_DATASOURCE_USERNAME", "DB_USER");
            }
            if (password == null) {
                password = getFirstNonBlank(env, "PGPASSWORD", "SPRING_DATASOURCE_PASSWORD", "DB_PASSWORD");
            }

            // Parse host, port, db, query
            int pathSlashIndex = hostPart.indexOf('/');
            String hostAndPort = pathSlashIndex != -1 ? hostPart.substring(0, pathSlashIndex) : hostPart;
            String pathAndQuery = pathSlashIndex != -1 ? hostPart.substring(pathSlashIndex + 1) : "";

            String host = hostAndPort;
            int port = 5432;
            int portColon = hostAndPort.indexOf(':');
            if (portColon != -1) {
                host = hostAndPort.substring(0, portColon);
                try {
                    port = Integer.parseInt(hostAndPort.substring(portColon + 1));
                } catch (NumberFormatException ignored) {}
            }

            if (!StringUtils.hasText(host)) {
                return null;
            }

            String database = "postgres";
            String queryParams = "";
            int questionIndex = pathAndQuery.indexOf('?');
            if (questionIndex != -1) {
                database = pathAndQuery.substring(0, questionIndex);
                queryParams = pathAndQuery.substring(questionIndex + 1);
            } else if (!pathAndQuery.isEmpty()) {
                database = pathAndQuery;
            }

            if (!StringUtils.hasText(database)) {
                database = "postgres";
            }

            boolean isLocalhost = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);

            StringBuilder jdbcBuilder = new StringBuilder();
            jdbcBuilder.append("jdbc:postgresql://").append(host).append(":").append(port).append("/").append(database);

            if (StringUtils.hasText(queryParams)) {
                if (!queryParams.contains("sslmode") && !isLocalhost) {
                    jdbcBuilder.append("?").append(queryParams).append("&sslmode=require");
                } else {
                    jdbcBuilder.append("?").append(queryParams);
                }
            } else if (!isLocalhost) {
                jdbcBuilder.append("?sslmode=require");
            }

            // Supabase Transaction Pooler (port 6543) requires prepareThreshold=0 to avoid PgBouncer prepared statement conflicts
            if (port == 6543 && !jdbcBuilder.toString().contains("prepareThreshold=")) {
                jdbcBuilder.append(jdbcBuilder.indexOf("?") != -1 ? "&" : "?").append("prepareThreshold=0");
            }

            return new DatabaseConnectionDetails(jdbcBuilder.toString(), username, password);
        } catch (Exception e) {
            log.error("Failed to parse PostgreSQL URI: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Invalid PostgreSQL URI: " + e.getMessage(), e);
        }
    }

    private static DatabaseConnectionDetails parseJdbcString(String jdbcUrl, Environment env) {
        String username = getFirstNonBlank(env, "SPRING_DATASOURCE_USERNAME", "PGUSER", "DB_USER", "DATABASE_USERNAME");
        String password = getFirstNonBlank(env, "SPRING_DATASOURCE_PASSWORD", "PGPASSWORD", "DB_PASSWORD", "DATABASE_PASSWORD");

        String updatedUrl = jdbcUrl;
        boolean isLocalhost = jdbcUrl.contains("//localhost") || jdbcUrl.contains("//127.0.0.1");
        if (!isLocalhost && !jdbcUrl.contains("sslmode=")) {
            updatedUrl += (jdbcUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }
        if (updatedUrl.contains(":6543") && !updatedUrl.contains("prepareThreshold=")) {
            updatedUrl += (updatedUrl.contains("?") ? "&" : "?") + "prepareThreshold=0";
        }

        return new DatabaseConnectionDetails(updatedUrl, username, password);
    }

    public static String sanitizeJdbcUrl(String jdbcUrl) {
        if (jdbcUrl == null) return null;
        return jdbcUrl.replaceAll("(?i)(password=)[^&;]*", "$1*****");
    }

    private static String getFirstNonBlank(Environment env, String... propertyNames) {
        if (env == null) return null;
        for (String name : propertyNames) {
            // First check system environment variables
            String sysEnv = System.getenv(name);
            if (StringUtils.hasText(sysEnv)) {
                return sysEnv.trim();
            }
            // Next check Spring properties
            String value = env.getProperty(name);
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private static String getFirstNonBlankOrDefault(Environment env, String defaultValue, String... propertyNames) {
        String value = getFirstNonBlank(env, propertyNames);
        return value != null ? value : defaultValue;
    }

    private static int getIntProperty(Environment env, String propertyName, int defaultValue) {
        if (env == null) return defaultValue;
        String envVal = System.getenv(propertyName);
        if (StringUtils.hasText(envVal)) {
            try {
                return Integer.parseInt(envVal.trim());
            } catch (NumberFormatException ignored) {}
        }
        String val = env.getProperty(propertyName);
        if (StringUtils.hasText(val)) {
            try {
                return Integer.parseInt(val.trim());
            } catch (NumberFormatException ignored) {}
        }
        return defaultValue;
    }
}
