package com.codeclash.service;

import com.codeclash.entity.Problem;
import com.codeclash.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProblemService {

    private final ProblemRepository problemRepository;
    private static final com.fasterxml.jackson.databind.ObjectMapper OBJECT_MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    public record TestCaseData(String input, String expected) {
    }

    public List<Problem> getAllProblems() {
        return problemRepository.findAll();
    }

    public List<Problem> getProblemsByDifficulty(String difficulty) {
        return problemRepository.findByDifficulty(difficulty);
    }

    public Problem getProblemById(Long id) {
        return problemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Problem not found"));
    }

    public com.fasterxml.jackson.databind.JsonNode resolveWrapperConfig(Problem problem, String userCode) {
        if (problem == null)
            return null;

        String configJson = safe(problem.getWrapperConfig());
        if (!configJson.isBlank()) {
            try {
                return OBJECT_MAPPER.readTree(configJson);
            } catch (Exception ignored) {
            }
        }

        List<TestCaseData> testCases = parseTestCases(problem);
        if (testCases.isEmpty())
            return null;

        String sampleInput = testCases.get(0).input();
        String[] lines = sampleInput == null ? new String[0] : sampleInput.split("\\n", -1);
        int paramCount = lines.length;

        String functionName = extractFirstJavaMethodName(userCode);
        if (functionName == null)
            functionName = extractFirstPythonFunctionName(userCode);
        if (functionName == null)
            functionName = "solution";

        try {
            java.util.List<java.util.Map<String, String>> params = new java.util.ArrayList<>();
            for (int i = 0; i < paramCount; i++) {
                String line = lines[i].trim();
                String type = "str";
                if (line.startsWith("[") && line.endsWith("]"))
                    type = "array";
                else if (line.matches("-?\\d+"))
                    type = "int";
                else if (line.matches("-?\\d+\\.\\d+"))
                    type = "float";
                else if (line.equals("true") || line.equals("false"))
                    type = "bool";

                params.add(java.util.Map.of("name", "arg" + i, "type", type));
            }

            java.util.Map<String, Object> configMap = java.util.Map.of(
                    "functionName", functionName,
                    "params", params);
            return OBJECT_MAPPER.valueToTree(configMap);
        } catch (Exception e) {
            return null;
        }
    }

    public List<TestCaseData> parseTestCases(Problem problem) {
        List<TestCaseData> jsonCases = parseJsonTestCases(problem.getTestCases());
        if (!jsonCases.isEmpty())
            return jsonCases;

        List<TestCaseData> legacyCases = parseLegacyTextCases(problem.getTestCases());
        if (!legacyCases.isEmpty())
            return legacyCases;

        String expected = safe(problem.getExpectedOutput()).trim();
        if (!expected.isBlank()) {
            return java.util.List.of(new TestCaseData("", expected));
        }
        return java.util.List.of();
    }

    private List<TestCaseData> parseJsonTestCases(String raw) {
        if (raw == null || raw.isBlank() || !raw.trim().startsWith("["))
            return java.util.List.of();
        try {
            com.fasterxml.jackson.databind.JsonNode root = OBJECT_MAPPER.readTree(raw);
            if (!root.isArray())
                return java.util.List.of();
            java.util.List<TestCaseData> cases = new java.util.ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode item : root) {
                String input;
                com.fasterxml.jackson.databind.JsonNode inputNode = item.path("input");
                if (inputNode.isArray()) {
                    java.util.List<String> lines = new java.util.ArrayList<>();
                    for (com.fasterxml.jackson.databind.JsonNode line : inputNode)
                        lines.add(line.asText(""));
                    input = String.join("\n", lines);
                } else
                    input = inputNode.asText("");
                String expected = item.path("expected").asText("");
                if (!expected.isBlank())
                    cases.add(new TestCaseData(input, expected));
            }
            return cases;
        } catch (Exception ignored) {
            return java.util.List.of();
        }
    }

    private List<TestCaseData> parseLegacyTextCases(String raw) {
        if (raw == null || raw.isBlank())
            return java.util.List.of();
        java.util.List<TestCaseData> cases = new java.util.ArrayList<>();
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                "Input:\\s*(.*?)\\s*Expected:\\s*(.*?)(?:\\r?\\n\\r?\\n|$)",
                java.util.regex.Pattern.DOTALL | java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher matcher = pattern.matcher(raw);
        while (matcher.find()) {
            String input = stripQuotes(safe(matcher.group(1)).trim());
            String expected = stripQuotes(safe(matcher.group(2)).trim());
            if (!expected.isBlank())
                cases.add(new TestCaseData(input, expected));
        }
        return cases;
    }

    private String extractFirstJavaMethodName(String code) {
        if (code == null || code.isBlank())
            return null;
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(
                "(?m)^\\s*public\\s+(?:static\\s+)?(?:[a-zA-Z_][a-zA-Z0-9_<>\\[\\]]*\\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(")
                .matcher(code);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String extractFirstPythonFunctionName(String code) {
        if (code == null || code.isBlank())
            return null;
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("(?m)^\\s*def\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(").matcher(code);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String stripQuotes(String value) {
        if (value == null || value.length() < 2)
            return safe(value);
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
