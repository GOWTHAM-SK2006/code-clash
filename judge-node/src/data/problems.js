// Input format: values are passed line-by-line (LeetCode style).
// Each line is consumed by a separate input() call in user code.

function assertAndNormalizeTestcases(testcases) {
  if (!Array.isArray(testcases) || testcases.length !== 15) {
    throw new Error("Each problem must define exactly 15 testcases");
  }

  return testcases.map((tc, index) => ({
    input: String(tc.input ?? ""),
    expected: String(tc.expected ?? ""),
    visible: index < 3
  }));
}

export const problems = [];

export function getProblemById(id) {
  return problems.find((p) => p.id === Number(id)) || null;
}
