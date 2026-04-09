import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 2000;

function truncateUtf8(str, maxBytes) {
  const buf = Buffer.from(str, "utf8");
  if (buf.length <= maxBytes) return str;
  return buf.subarray(0, maxBytes).toString("utf8");
}

export async function executePython({ code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return executeGeneric({ code, stdin, timeoutMs, lang: 'python', filename: 'solution.py', command: 'python3', args: ['solution.py'] });
}

export async function executeCpp({ code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return executeGeneric({ code, stdin, timeoutMs, lang: 'cpp', filename: 'solution.cpp', compileCommand: 'g++', compileArgs: ['solution.cpp', '-o', 'solution'], command: './solution' });
}

export async function executeC({ code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return executeGeneric({ code, stdin, timeoutMs, lang: 'c', filename: 'solution.c', compileCommand: 'gcc', compileArgs: ['solution.c', '-o', 'solution'], command: './solution' });
}

export async function executeJava({ code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  // Detect public class name for Java
  const classMatch = code.match(/(public\s+)?class\s+(\w+)/);
  const className = classMatch ? classMatch[2] : "Solution";
  const filename = `${className}.java`;

  return executeGeneric({
    code,
    stdin,
    timeoutMs,
    lang: 'java',
    filename,
    compileCommand: 'javac',
    compileArgs: [filename],
    command: 'java',
    args: [className]
  });
}

export async function executeJavascript({ code, stdin = "", timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return executeGeneric({ code, stdin, timeoutMs, lang: 'javascript', filename: 'solution.js', command: 'node', args: ['solution.js'] });
}

async function executeGeneric({ code, stdin, timeoutMs, lang, filename, compileCommand, compileArgs, command, args = [] }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeclash-"));
  const filePath = path.join(tempDir, filename);

  try {
    await fs.writeFile(filePath, code ?? "", { mode: 0o600 });

    // Compilation step if needed
    if (compileCommand) {
      const compileResult = await runCommand(compileCommand, compileArgs, tempDir, 5000); // 5s compile timeout
      if (compileResult.exitCode !== 0) {
        return { exitCode: 1, stdout: "", stderr: `Compilation Error:\n${compileResult.stderr}`, timedOut: false, isCompileError: true };
      }
    }

    // Execution step
    return await runCommand(command, args, tempDir, timeoutMs, stdin);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runCommand(command, args, cwd, timeoutMs, stdin = "") {
  let timedOut = false;
  const child = spawn(command, args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    env: { PATH: process.env.PATH }
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout = truncateUtf8(stdout + chunk.toString("utf8"), MAX_OUTPUT_BYTES);
  });

  child.stderr.on("data", (chunk) => {
    stderr = truncateUtf8(stderr + chunk.toString("utf8"), MAX_OUTPUT_BYTES);
  });

  if (stdin) child.stdin.write(stdin);
  child.stdin.end();

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: `Executor error: ${err.message}`, timedOut: false });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
    });
  });

  return result;
}
