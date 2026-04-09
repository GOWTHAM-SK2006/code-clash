package com.codeclash.service;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.PullImageResultCallback;
import com.github.dockerjava.api.model.Bind;
import com.github.dockerjava.api.model.HostConfig;
import com.github.dockerjava.api.model.Volume;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.zerodep.ZerodepDockerHttpClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class DockerSandboxService {

    private static final Logger log = LoggerFactory.getLogger(DockerSandboxService.class);
    private DockerClient dockerClient;
    private boolean isAvailable = false;

    public static class ExecutionResult {
        private String stdout;
        private String stderr;
        private int exitCode;
        private boolean timedOut;

        public ExecutionResult(String stdout, String stderr, int exitCode, boolean timedOut) {
            this.stdout = stdout;
            this.stderr = stderr;
            this.exitCode = exitCode;
            this.timedOut = timedOut;
        }

        public String getStdout() {
            return stdout;
        }

        public String getStderr() {
            return stderr;
        }

        public int getExitCode() {
            return exitCode;
        }

        public boolean isTimedOut() {
            return timedOut;
        }

        public static class Builder {
            private String stdout = "";
            private String stderr = "";
            private int exitCode = 0;
            private boolean timedOut = false;

            public Builder stdout(String s) {
                this.stdout = s;
                return this;
            }

            public Builder stderr(String s) {
                this.stderr = s;
                return this;
            }

            public Builder exitCode(int e) {
                this.exitCode = e;
                return this;
            }

            public Builder timedOut(boolean t) {
                this.timedOut = t;
                return this;
            }

            public ExecutionResult build() {
                return new ExecutionResult(stdout, stderr, exitCode, timedOut);
            }
        }

        public static Builder builder() {
            return new Builder();
        }
    }

    @PostConstruct
    public void init() {
        try {
            DefaultDockerClientConfig config = DefaultDockerClientConfig.createDefaultConfigBuilder().build();
            ZerodepDockerHttpClient httpClient = new ZerodepDockerHttpClient.Builder()
                    .dockerHost(config.getDockerHost())
                    .sslConfig(config.getSSLConfig())
                    .maxConnections(100)
                    .connectionTimeout(Duration.ofSeconds(5))
                    .responseTimeout(Duration.ofSeconds(5))
                    .build();

            this.dockerClient = DockerClientImpl.getInstance(config, httpClient);

            // Ping to check availability
            dockerClient.pingCmd().exec();
            isAvailable = true;
            log.info("Docker is available. Sandboxing enabled.");

            // Pull images asynchronously
            new Thread(() -> {
                pullImage("python:3.11-slim");
                pullImage("openjdk:17-slim");
                pullImage("node:20-slim");
                pullImage("gcc:13");
            }).start();
        } catch (Exception e) {
            isAvailable = false;
            log.warn(
                    "Docker is NOT available (missing installation or permissions). Secure execution will be skipped: {}",
                    e.getMessage());
        }
    }

    private void pullImage(String image) {
        if (!isAvailable)
            return;
        try {
            log.info("Checking image presence: {}", image);
            dockerClient.pullImageCmd(image)
                    .exec(new PullImageResultCallback())
                    .awaitCompletion(5, TimeUnit.MINUTES);
        } catch (Exception e) {
            log.warn("Failed to pull image {}: {}", image, e.getMessage());
        }
    }

    public ExecutionResult execute(String code, String language) {
        return execute(code, language, null);
    }

    public ExecutionResult execute(String code, String language, String inputData) {
        if (!isAvailable) {
            return executeWithoutDocker(code, language, inputData);
        }

        String containerId = null;
        Path tempDir = null;
        try {
            log.info("Running code with input: {}", inputData);
            tempDir = Files.createTempDirectory("codeclash-exec-" + UUID.randomUUID());
            String fileName = getFileName(language, code);
            File codeFile = new File(tempDir.toFile(), fileName);
            try (FileWriter writer = new FileWriter(codeFile)) {
                writer.write(code);
            }

            File inputFile = new File(tempDir.toFile(), "input.txt");
            try (FileWriter writer = new FileWriter(inputFile)) {
                writer.write(inputData == null ? "" : inputData);
            }

            String image = getImage(language);
            String[] cmd = getRunCommand(language, fileName, code);

            HostConfig hostConfig = HostConfig.newHostConfig()
                    .withMemory(128 * 1024 * 1024L) // 128MB
                    .withNanoCPUs(500000000L) // 0.5 vCPU
                    .withNetworkMode("none")
                    .withBinds(new Bind(tempDir.toAbsolutePath().toString(), new Volume("/app")));

            CreateContainerResponse container = dockerClient.createContainerCmd(image)
                    .withHostConfig(hostConfig)
                    .withWorkingDir("/app")
                    .withCmd(cmd)
                    .withUser("nobody")
                    .exec();

            containerId = container.getId();
            dockerClient.startContainerCmd(containerId).exec();

            // Wait for completion (max 5s)
            int exitCode = -1;
            boolean timedOut = false;
            try {
                exitCode = dockerClient.waitContainerCmd(containerId)
                        .start()
                        .awaitStatusCode(5, TimeUnit.SECONDS);
            } catch (Exception e) {
                timedOut = true;
                log.warn("Container timed out: {}", containerId);
                try {
                    dockerClient.killContainerCmd(containerId).exec();
                } catch (Exception killEx) {
                    log.warn("Failed to kill container {}: {}", containerId, killEx.getMessage());
                }
            }

            // Capture logs
            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();

            dockerClient.logContainerCmd(containerId)
                    .withStdOut(true)
                    .withStdErr(true)
                    .withFollowStream(true)
                    .exec(new com.github.dockerjava.api.async.ResultCallback.Adapter<com.github.dockerjava.api.model.Frame>() {
                        @Override
                        public void onNext(com.github.dockerjava.api.model.Frame item) {
                            if (item.getStreamType() == com.github.dockerjava.api.model.StreamType.STDOUT) {
                                stdout.append(new String(item.getPayload()));
                            } else if (item.getStreamType() == com.github.dockerjava.api.model.StreamType.STDERR) {
                                stderr.append(new String(item.getPayload()));
                            }
                        }
                    }).awaitCompletion(5, TimeUnit.SECONDS);

            return ExecutionResult.builder()
                    .stdout(stdout.toString())
                    .stderr(stderr.toString())
                    .exitCode(exitCode)
                    .timedOut(timedOut)
                    .build();

        } catch (Exception e) {
            log.error("Execution failed", e);
            return ExecutionResult.builder()
                    .stderr(e.getMessage())
                    .exitCode(1)
                    .build();
        } finally {
            if (containerId != null) {
                try {
                    dockerClient.removeContainerCmd(containerId).withForce(true).exec();
                } catch (Exception e) {
                    log.warn("Failed to remove container {}", containerId);
                }
            }
            if (tempDir != null) {
                try {
                    Files.walk(tempDir)
                            .sorted((a, b) -> b.compareTo(a))
                            .forEach(p -> p.toFile().delete());
                } catch (Exception e) {
                    log.warn("Failed to cleanup temp dir {}", tempDir);
                }
            }
        }
    }

    private ExecutionResult executeWithoutDocker(String code, String language, String inputData) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("codeclash-local-exec-" + UUID.randomUUID());
            String fileName = getFileName(language, code);
            File codeFile = new File(tempDir.toFile(), fileName);
            try (FileWriter writer = new FileWriter(codeFile)) {
                writer.write(code);
            }

            File inputFile = new File(tempDir.toFile(), "input.txt");
            try (FileWriter writer = new FileWriter(inputFile)) {
                writer.write(inputData == null ? "" : inputData);
            }

            String[] cmd = getRunCommand(language, fileName, code);
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(tempDir.toFile());

            Process process = pb.start();
            StringBuilder stdout = new StringBuilder();
            StringBuilder stderr = new StringBuilder();

            Thread outThread = new Thread(() -> appendStream(process.getInputStream(), stdout));
            Thread errThread = new Thread(() -> appendStream(process.getErrorStream(), stderr));
            outThread.start();
            errThread.start();

            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                outThread.join(1000);
                errThread.join(1000);
                return ExecutionResult.builder()
                        .stdout(stdout.toString())
                        .stderr("Execution timed out (local fallback).\n" + stderr)
                        .exitCode(1)
                        .timedOut(true)
                        .build();
            }

            int exitCode = process.exitValue();
            outThread.join(1000);
            errThread.join(1000);

            String warning = "Docker not available. Executed using local fallback runner.\n";
            return ExecutionResult.builder()
                    .stdout(stdout.toString())
                    .stderr((warning + stderr).trim())
                    .exitCode(exitCode)
                    .timedOut(false)
                    .build();
        } catch (IOException ioException) {
            String command = Arrays.toString(getRunCommand(language, getFileName(language, code), code));
            return ExecutionResult.builder()
                    .stderr("Local runner unavailable for language " + language + ". Command: " + command
                            + "\nReason: " + ioException.getMessage())
                    .exitCode(1)
                    .timedOut(false)
                    .build();
        } catch (Exception e) {
            return ExecutionResult.builder()
                    .stderr("Local fallback execution failed: " + e.getMessage())
                    .exitCode(1)
                    .timedOut(false)
                    .build();
        } finally {
            if (tempDir != null) {
                try {
                    Files.walk(tempDir)
                            .sorted((a, b) -> b.compareTo(a))
                            .forEach(p -> p.toFile().delete());
                } catch (Exception e) {
                    log.warn("Failed to cleanup local temp dir {}", tempDir);
                }
            }
        }
    }

    private void appendStream(InputStream inputStream, StringBuilder target) {
        try {
            byte[] bytes = inputStream.readAllBytes();
            target.append(new String(bytes, StandardCharsets.UTF_8));
        } catch (IOException ignored) {
        }
    }

    private String getJavaClassName(String code) {
        if (code == null)
            return "Solution";
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(public\\s+)?class\\s+(\\w+)").matcher(code);
        return matcher.find() ? matcher.group(2) : "Solution";
    }

    private String getFileName(String language, String code) {
        return switch (language.toUpperCase()) {
            case "PYTHON" -> "solution.py";
            case "JAVA" -> getJavaClassName(code) + ".java";
            case "JAVASCRIPT" -> "solution.js";
            case "C" -> "solution.c";
            case "CPP" -> "solution.cpp";
            default -> "solution.txt";
        };
    }

    private String getImage(String language) {
        return switch (language.toUpperCase()) {
            case "PYTHON" -> "python:3.11-slim";
            case "JAVA" -> "openjdk:17-slim";
            case "JAVASCRIPT" -> "node:20-slim";
            case "C", "CPP" -> "gcc:13";
            default -> "python:3.11-slim";
        };
    }

    private String[] getRunCommand(String language, String fileName, String code) {
        return switch (language.toUpperCase()) {
            case "PYTHON" -> new String[] { "sh", "-c", "python3 " + fileName + " < input.txt" };
            case "JAVA" -> {
                String className = getJavaClassName(code);
                yield new String[] { "sh", "-c", "javac " + fileName + " && java " + className + " < input.txt" };
            }
            case "JAVASCRIPT" -> new String[] { "sh", "-c", "node " + fileName + " < input.txt" };
            case "C" ->
                new String[] { "sh", "-c", "gcc -O2 -std=c11 " + fileName + " -o solution && ./solution < input.txt" };
            case "CPP" -> new String[] { "sh", "-c",
                    "g++ -O2 -std=c++17 " + fileName + " -o solution && ./solution < input.txt" };
            default -> new String[] { "cat", fileName };
        };
    }
}
