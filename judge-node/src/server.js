import express from "express";
import judgeRoutes from "./routes/judgeRoutes.js";
import { createBattle } from "./services/battleService.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

createBattle({ id: "b1", problemId: 1, playerA: "u1", playerB: "u2" });

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api", judgeRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`CodeClash judge listening on ${port}`);
});
