# CodeClash: Secure Code Execution Architecture

To ensure a safe and performant environment for executing user-submitted code (Python, Java, JS, etc.), CodeClash uses a containerized sandbox architecture.

## Execution Flow

1.  **Submission**: User submits code via the frontend.
2.  **API Handler**: Backend `SubmissionService` receives the code and problem ID.
3.  **Sandbox Spawning**: For each execution, a transient Docker container is created using a language-specific image (e.g., `python:3.11-slim`).
4.  **Code Injection**: The user's code and test cases are mounted into the container.
5.  **Execution**: The code runs inside the container under strict resource limits.
6.  **Capture**: Standard output and errors are captured.
7.  **Termination**: The container is immediately destroyed.
8.  **Result**: The output is returned to the user and compared against expected results.

## Security & Safety Limits

To prevent malicious activity and resource exhaustion, the following limits are enforced on every container:

| Limit Type | Value | Purpose |
| :--- | :--- | :--- |
| **CPU Limit** | 0.5 vCPU | Prevents crypto-mining or heavy processing from slowing down the host. |
| **Memory Limit** | 128 MB | Prevents memory-leak attacks or OOM issues on the server. |
| **Timeout** | 5 seconds | Kills infinite loops or hanging processes. |
| **Network** | Disabled | Prevents the code from making external requests or scanning the local network. |
| **Disk Write** | 10 MB | Prevents filling up the host's disk space. |
| **Root Privileges** | Non-root | The container runs as a restricted user to prevent privilege escalation. |

## Implementation Sketch (Docker SDK)

```java
// Example conceptual code using Docker Java SDK
CreateContainerResponse container = dockerClient.createContainerCmd("codeclash-python-runner")
    .withHostConfig(new HostConfig()
        .withMemory(128 * 1024 * 1024L)
        .withNanoCPUs(500000000L)
        .withNetworkMode("none"))
    .withCmd("python3", "/path/to/user_code.py")
    .exec();

dockerClient.startContainerCmd(container.getId()).exec();
// Wait for exit, capture logs, then remove container
```

> [!IMPORTANT]
> This architecture ensures that even if a user submits malicious code (e.g., `import os; os.system("rm -rf /")`), it will only affect the isolated, non-networked container and will be wiped clean immediately after execution.
