import express from "express";
import { getProblemById } from "../data/problems.js";
import { judgeSubmission, runVisibleTestcases, runFunctionStyleTestcases } from "../services/judgeService.js";
import { getBattle, upsertSubmission } from "../services/battleService.js";

const router = express.Router();

router.post("/run-code", async (req, res) => {
  try {
    const { code, language = "python", problemId } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is required" });
    }

    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }

    const problem = getProblemById(problemId);
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const result = await runVisibleTestcases({ code, problem, language, timeoutMs: 2000 });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Run failed", details: err.message });
  }
});

router.post("/submit-code", async (req, res) => {
  try {
    const { battleId, playerId, problemId, code, language = "python" } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is required" });
    }
    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }

    const problem = getProblemById(problemId);
    if (!problem) return res.status(404).json({ error: "Problem not found" });

    const startedAt = Date.now();
    const judge = await judgeSubmission({ code, problem, language, timeoutMs: 2000 });
    const completedAt = Date.now();

    // Battle mode: update battle state if both battleId and playerId provided
    let winner = null;
    if (battleId && playerId) {
      const battle = getBattle(battleId);
      if (!battle) return res.status(404).json({ error: "Battle not found" });

      const battleResult = {
        status: judge.verdict === "Accepted ✅" ? "ACCEPTED" : "NOT_ACCEPTED",
        completedAt,
        durationMs: completedAt - startedAt
      };

      const updatedBattle = upsertSubmission({ battleId, playerId, result: battleResult });
      winner = updatedBattle?.winner ?? null;
    }

    return res.json({
      ...judge,
      ...(winner !== null && { winner })
    });
  } catch (err) {
    return res.status(500).json({ error: "Submit failed", details: err.message });
  }
});

// LeetCode-style function-only code execution
router.post("/run-function-style", async (req, res) => {
  try {
    const { code, functionName, problemId, language = "python" } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is required" });
    }
    if (!functionName || typeof functionName !== "string") {
      return res.status(400).json({ error: "functionName is required" });
    }
    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }
    const problem = getProblemById(problemId);
    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }
    const result = await runFunctionStyleTestcases({ userCode: code, functionName, problem, timeoutMs: 2000 });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Run failed", details: err.message });
  }
});

export default router;
