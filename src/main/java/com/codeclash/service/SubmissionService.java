package com.codeclash.service;

import com.codeclash.dto.SubmissionRequest;
import com.codeclash.dto.SubmissionResponse;
import com.codeclash.entity.*;
import com.codeclash.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class SubmissionService {

    private static final long JUDGE_TIMEOUT_SECONDS = 2;
    private static final int MAX_STREAM_BYTES = 64 * 1024;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final SubmissionRepository submissionRepository;
    private final ProblemRepository problemRepository;
    private final UserRepository userRepository;
    private final CoinService coinService;
    private final DockerSandboxService dockerSandboxService;
    private final LanguageRepository languageRepository;

    public SubmissionService(SubmissionRepository submissionRepository,
            ProblemRepository problemRepository,
            UserRepository userRepository,
            CoinService coinService,
            DockerSandboxService dockerSandboxService,
            LanguageRepository languageRepository) {
        this.submissionRepository = submissionRepository;
        this.problemRepository = problemRepository;
        this.userRepository = userRepository;
        this.coinService = coinService;
        this.dockerSandboxService = dockerSandboxService;
        this.languageRepository = languageRepository;
    }

    @Transactional
    public SubmissionResponse submitCode(String username, SubmissionRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Problem problem = problemRepository.findById(request.getProblemId())
                .orElseThrow(() -> new RuntimeException("Problem not found"));

        // Check if language is enabled
        languageRepository.findBySlug(request.getLanguage())
                .filter(Language::isEnabled)
                .orElseThrow(() -> new RuntimeException("Language " + request.getLanguage() + " is currently disabled."));

        String status;
        String message;

        // Unified test case judge for ALL languages
        String language = request.getLanguage();
        List<TestCaseData> testCases = parseTestCases(problem);

        if (testCases.isEmpty()) {
            // No test cases — just run and compare to expected output
            DockerSandboxService.ExecutionResult result = dockerSandboxService.execute(
                    request.getCode(), language, "");
            status = "WRONG_ANSWER";
            message = "Wrong answer";

            if (result.isTimedOut()) {
                status = "TIME_LIMIT_EXCEEDED";
                message = "Execution timed out (5s)";
            } else if (result.getExitCode() != 0) {
                status = "RUNTIME_ERROR";
                message = result.getStderr();
            } else {
                String output = normalizeOutput(result.getStdout());
                String expected = normalizeOutput(problem.getExpectedOutput());
                if (output.equals(expected)) {
                    status = "ACCEPTED";
                    message = "All test cases passed!";
                } else {
                    message = "Expected: " + expected + "\nActual: " + output;
                }
            }
        } else {
            // Run through all test cases with normalized input
            int passed = 0;
            int failed = 0;
            StringBuilder report = new StringBuilder();

            for (int i = 0; i < testCases.size(); i++) {
                TestCaseData tc = testCases.get(i);
                String normalizedInput = normalizeInputData(tc.input());
                DockerSandboxService.ExecutionResult result = dockerSandboxService.execute(
                        request.getCode(), language, normalizedInput);
                int caseNo = i + 1;

                if (result.isTimedOut()) {
                    failed++;
                    report.append("Testcase ").append(caseNo).append(": TLE\n");
                    break;
                } else if (result.getExitCode() != 0) {
                    failed++;
                    report.append("Testcase ").append(caseNo).append(": RE\n");
                    report.append(result.getStderr()).append("\n");
                    break;
                } else {
                    String actual = normalizeOutput(result.getStdout());
                    String expected = normalizeOutput(tc.expected());
                    if (actual.equals(expected)) {
                        passed++;
                        report.append("Testcase ").append(caseNo).append(": AC\n");
                    } else {
                        failed++;
                        report.append("Testcase ").append(caseNo).append(": WA\n");
                        report.append("Expected: ").append(tc.expected()).append("\n");
                        report.append("Got: ").append(result.getStdout()).append("\n");
                    }
                }
            }

            if (failed == 0) {
                status = "ACCEPTED";
                report.append("\nAll test cases passed! (").append(passed).append("/").append(testCases.size())
                        .append(")");
                message = report.toString().trim();
            } else if (report.toString().contains("RE")) {
                status = "RUNTIME_ERROR";
                message = report.toString().trim();
            } else if (report.toString().contains("TLE")) {
                status = "TIME_LIMIT_EXCEEDED";
                message = report.toString().trim();
            } else {
                status = "WRONG_ANSWER";
                report.append("\nPassed ").append(passed).append("/").append(testCases.size());
                message = report.toString().trim();
            }
        }

        Submission submission = new Submission();
        submission.setUser(user);
        submission.setProblem(problem);
        submission.setCode(request.getCode());
        submission.setLanguage(request.getLanguage());
        submission.setStatus(status);
        submission.setOutput(message);

        submissionRepository.save(submission);

        if ("ACCEPTED".equals(status)) {
            // Check if first time solving
            long prevAccepted = submissionRepository.countByUserIdAndStatus(user.getId(), "ACCEPTED");
            if (prevAccepted <= 1) { // 1 because we just saved this one
                user.setProblemsSolved(user.getProblemsSolved() + 1);
                userRepository.save(user);
                coinService.awardCoins(user, problem.getPoints(), "Solved: " + problem.getTitle());
            }
        }

        return toResponse(submission);
    }

    public List<SubmissionResponse> getUserSubmissions(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return submissionRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private SubmissionResponse toResponse(Submission s) {
        SubmissionResponse res = new SubmissionResponse();
        res.setId(s.getId());
        res.setProblemId(s.getProblem().getId());
        res.setProblemTitle(s.getProblem().getTitle());
        res.setCode(s.getCode());
        res.setLanguage(s.getLanguage());
        res.setStatus(s.getStatus());
        res.setOutput(s.getOutput());
        res.setCreatedAt(s.getCreatedAt());
        return res;
    }

    private JudgeSummary judgePythonSubmission(Problem problem, String userCode) {
        List<TestCaseData> testCases = parseTestCases(problem);
        if (testCases.isEmpty()) {
            return new JudgeSummary("RUNTIME_ERROR", "No valid test cases configured for this problem.");
        }

        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("codeclash-judge-" + UUID.randomUUID());
            Path solutionFile = tempDir.resolve("solution.py");
            Files.writeString(solutionFile, userCode == null ? "" : userCode, StandardCharsets.UTF_8);

            int passed = 0;
            int failed = 0;
            StringBuilder report = new StringBuilder();

            for (int index = 0; index < testCases.size(); index++) {
                TestCaseData testCase = testCases.get(index);
                CaseExecutionResult result = executePythonCase(solutionFile, testCase.input());

                int caseNo = index + 1;

                if (result.timedOut()) {
                    failed++;
                    report.append("Testcase ").append(caseNo).append(": Failed\n");
                    report.append("Reason: Time Limit Exceeded (2s)\n");
                    break;
                }

                if (result.exitCode() != 0) {
                    failed++;
                    report.append("Testcase ").append(caseNo).append(": Failed\n");
                    report.append("Reason: Runtime Error\n");
                    report.append(result.stderr().isBlank() ? "Python execution failed." : result.stderr())
                            .append("\n");
                    return new JudgeSummary("RUNTIME_ERROR", report.toString().trim());
                }

                String expected = normalizeOutput(testCase.expected());
                String actual = normalizeOutput(result.stdout());

                if (expected.equals(actual)) {
                    passed++;
                    report.append("Testcase ").append(caseNo).append(": Passed\n");
                } else {
                    failed++;
                    report.append("Testcase ").append(caseNo).append(": Failed\n");
                    report.append("Expected: ").append(testCase.expected()).append("\n");
                    report.append("Got: ").append(result.stdout().isBlank() ? "<empty>" : result.stdout()).append("\n");
                }
            }

            if (failed == 0) {
                report.append("\nAll test cases passed! (").append(passed).append("/").append(testCases.size())
                        .append(")");
                return new JudgeSummary("ACCEPTED", report.toString().trim());
            }

            report.append("\nSummary: Passed ").append(passed).append(", Failed ").append(failed);
            return new JudgeSummary("WRONG_ANSWER", report.toString().trim());
        } catch (IOException exception) {
            return new JudgeSummary("RUNTIME_ERROR", "Judge setup failed: " + exception.getMessage());
        } finally {
            cleanupTempDirectory(tempDir);
        }
    }

    private CaseExecutionResult executePythonCase(Path solutionFile, String input) {
        Process process = null;
        try {
            ProcessBuilder processBuilder = new ProcessBuilder("python3", solutionFile.toString());
            processBuilder.directory(solutionFile.getParent().toFile());
            process = processBuilder.start();

            try (OutputStream stdin = process.getOutputStream()) {
                if (input != null) {
                    stdin.write(input.getBytes(StandardCharsets.UTF_8));
                }
            }

            StreamCollector stdoutCollector = new StreamCollector(process.getInputStream());
            StreamCollector stderrCollector = new StreamCollector(process.getErrorStream());
            stdoutCollector.start();
            stderrCollector.start();

            boolean finished = process.waitFor(JUDGE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                stdoutCollector.join(300);
                stderrCollector.join(300);
                return new CaseExecutionResult("", "Execution timed out", 1, true);
            }

            stdoutCollector.join(300);
            stderrCollector.join(300);
            return new CaseExecutionResult(
                    stdoutCollector.content(),
                    stderrCollector.content(),
                    process.exitValue(),
                    false);
        } catch (IOException e) {
            return new CaseExecutionResult("", "Cannot execute python3: " + e.getMessage(), 1, false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new CaseExecutionResult("", "Execution interrupted", 1, false);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
        }
    }

    private List<TestCaseData> parseTestCases(Problem problem) {
        List<TestCaseData> parsedCases = parseJsonTestCases(problem.getTestCases());
        if (!parsedCases.isEmpty()) {
            return parsedCases;
        }

        List<TestCaseData> legacyCases = parseLegacyTextTestCases(problem.getTestCases());
        if (!legacyCases.isEmpty()) {
            return legacyCases;
        }

        String expected = safe(problem.getExpectedOutput());
        if (!expected.isBlank()) {
            return List.of(new TestCaseData("", expected));
        }

        return List.of();
    }

    private List<TestCaseData> parseJsonTestCases(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }

        String trimmed = raw.trim();
        if (!trimmed.startsWith("[")) {
            return List.of();
        }

        try {
            JsonNode root = OBJECT_MAPPER.readTree(trimmed);
            if (!root.isArray()) {
                return List.of();
            }

            List<TestCaseData> testCases = new ArrayList<>();
            for (JsonNode node : root) {
                String input = node.path("input").asText("");
                String expected = node.path("expected").asText("");
                if (!expected.isBlank()) {
                    testCases.add(new TestCaseData(input, expected));
                }
            }
            return testCases;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<TestCaseData> parseLegacyTextTestCases(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }

        List<TestCaseData> testCases = new ArrayList<>();
        Pattern pattern = Pattern.compile("Input:\\s*(.*?)\\s*Expected:\\s*(.*?)(?:\\r?\\n\\r?\\n|$)", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(raw);

        while (matcher.find()) {
            String input = cleanupValue(matcher.group(1));
            String expected = cleanupValue(matcher.group(2));
            if (!expected.isBlank()) {
                testCases.add(new TestCaseData(input, expected));
            }
        }

        if (!testCases.isEmpty()) {
            return testCases;
        }

        String firstInput = "";
        Matcher inputMatcher = Pattern.compile("Input:\\s*(.*)", Pattern.CASE_INSENSITIVE).matcher(raw);
        if (inputMatcher.find()) {
            firstInput = cleanupValue(inputMatcher.group(1));
        }

        Matcher expectedMatcher = Pattern.compile("Expected:\\s*(.*)", Pattern.CASE_INSENSITIVE).matcher(raw);
        if (expectedMatcher.find()) {
            String expected = cleanupValue(expectedMatcher.group(1));
            if (!expected.isBlank()) {
                return List.of(new TestCaseData(firstInput, expected));
            }
        }

        return List.of();
    }

    private String normalizeOutput(String value) {
        return safe(value).replace("\r\n", "\n").trim();
    }

    private String cleanupValue(String value) {
        String cleaned = safe(value).trim();
        if ((cleaned.startsWith("\"") && cleaned.endsWith("\""))
                || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
            return cleaned.substring(1, cleaned.length() - 1);
        }
        return cleaned;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    /**
     * Converts JSON-style inputs to standard CP stdin format.
     * e.g., "[1,2,3,4]" → "4\n1 2 3 4"
     */
    private String normalizeInputData(String raw) {
        if (raw == null || raw.trim().isEmpty())
            return "";
        String[] lines = raw.split("\n");
        StringBuilder result = new StringBuilder();

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty())
                continue;

            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    String inner = trimmed.substring(1, trimmed.length() - 1).trim();
                    if (inner.isEmpty()) {
                        if (result.length() > 0)
                            result.append("\n");
                        result.append("0");
                        continue;
                    }
                    String[] elements = inner.split("\\s*,\\s*");
                    if (result.length() > 0)
                        result.append("\n");
                    result.append(elements.length);
                    result.append("\n").append(String.join(" ", elements));
                } catch (Exception e) {
                    if (result.length() > 0)
                        result.append("\n");
                    result.append(trimmed);
                }
            } else {
                if (result.length() > 0)
                    result.append("\n");
                result.append(trimmed);
            }
        }

        return result.toString();
    }

    private void cleanupTempDirectory(Path tempDir) {
        if (tempDir == null) {
            return;
        }
        try {
            Files.walk(tempDir)
                    .sorted((a, b) -> b.compareTo(a))
                    .forEach(path -> path.toFile().delete());
        } catch (Exception ignored) {
        }
    }

    private record TestCaseData(String input, String expected) {
    }

    private record CaseExecutionResult(String stdout, String stderr, int exitCode, boolean timedOut) {
    }

    private record JudgeSummary(String status, String message) {
    }

    private static class StreamCollector extends Thread {
        private final InputStream inputStream;
        private final ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        private StreamCollector(InputStream inputStream) {
            this.inputStream = inputStream;
        }

        @Override
        public void run() {
            byte[] buffer = new byte[1024];
            int read;
            try {
                while ((read = inputStream.read(buffer)) != -1) {
                    if (outputStream.size() + read > MAX_STREAM_BYTES) {
                        int allowed = MAX_STREAM_BYTES - outputStream.size();
                        if (allowed > 0) {
                            outputStream.write(buffer, 0, allowed);
                        }
                        break;
                    }
                    outputStream.write(buffer, 0, read);
                }
            } catch (IOException ignored) {
            }
        }

        private String content() {
            return outputStream.toString(StandardCharsets.UTF_8).trim();
        }
    }
}
