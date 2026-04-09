import { executePython, executeCpp, executeC, executeJava, executeJavascript } from "./executor.js";
import { normalizeInput } from "../utils/inputNormalizer.js";

function normalizeOutput(value) {
  return String(value ?? "").trim();
}

const executors = {
  python: executePython,
  java: executeJava,
  c: executeC,
  cpp: executeCpp,
  javascript: executeJavascript
};

/**
 * Executes user code exactly as written.
 * Stdin is used for input, Stdout for output.
 */
export async function judgeSubmission({ code, language = 'python', testcases = [] }) {
  const executor = executors[language] || executePython;
  const tcResults = [];
  let passedCount = 0;

  for (let i = 0; i < testcases.length; i++) {
    const tc = testcases[i];
    const normalizedStdin = normalizeInput(tc.input || "");
    const exec = await executor({
      code,
      stdin: normalizedStdin,
      timeoutMs: 3000 // Standard 3s timeout
    });

    let result = "AC";
    const actual = normalizeOutput(exec.stdout);
    const expected = normalizeOutput(tc.expected);

    if (exec.timedOut) {
      result = "TLE";
    } else if (exec.exitCode !== 0) {
      result = "RE";
    } else if (actual !== expected) {
      result = "WA";
    }

    if (result === "AC") passedCount++;

    tcResults.push({
      input: tc.input,
      expected: expected,
      actual: actual,
      result: result
    });
  }

  const status = passedCount === testcases.length ? "ACCEPTED"
    : (tcResults.some(r => r.result === "RE") ? "RUNTIME_ERROR" : (tcResults.some(r => r.result === "TLE") ? "TIME_LIMIT_EXCEEDED" : "WRONG_ANSWER"));

  return {
    status,
    testcases: tcResults
  };
}

// Minimal runCode for testing
export async function runCode({ code, language = 'python', stdin = "" }) {
  const executor = executors[language] || executePython;
  const normalizedStdin = normalizeInput(stdin);
  const exec = await executor({ code, stdin: normalizedStdin });
  return {
    ok: !exec.timedOut && exec.exitCode === 0,
    stdout: exec.stdout,
    stderr: exec.stderr,
    timedOut: exec.timedOut
  };
}
