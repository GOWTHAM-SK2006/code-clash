package com.codeclash.util;

import java.util.List;
import java.util.stream.Collectors;

public class StringUtil {

    public static List<String> parseStringList(Object obj) {
        if (obj instanceof List<?> list) {
            return list.stream().map(String::valueOf).map(String::trim)
                    .filter(s -> !s.isBlank()).toList();
        }
        if (obj == null)
            return List.of();
        String raw = String.valueOf(obj).trim();
        if (raw.isBlank())
            return List.of();
        return List.of(raw.split(",")).stream().map(String::trim).filter(s -> !s.isBlank()).toList();
    }

    public static String safe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    public static int parseInt(Object value, int fallback) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return fallback;
        }
    }
}
