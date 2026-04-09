const battles = new Map();

export function createBattle({ id, problemId, playerA, playerB }) {
  battles.set(String(id), {
    id: String(id),
    problemId,
    playerA,
    playerB,
    submissions: {},
    winner: null
  });
  return battles.get(String(id));
}

export function getBattle(id) {
  return battles.get(String(id)) || null;
}

export function upsertSubmission({ battleId, playerId, result }) {
  const battle = getBattle(battleId);
  if (!battle) return null;

  battle.submissions[playerId] = {
    status: result.status,
    completedAt: result.completedAt,
    durationMs: result.durationMs
  };

  const subA = battle.submissions[battle.playerA];
  const subB = battle.submissions[battle.playerB];

  const aAC = subA?.status === "ACCEPTED";
  const bAC = subB?.status === "ACCEPTED";

  if (aAC && !bAC) battle.winner = battle.playerA;
  else if (!aAC && bAC) battle.winner = battle.playerB;
  else if (aAC && bAC) {
    battle.winner = subA.completedAt <= subB.completedAt ? battle.playerA : battle.playerB;
  }

  return battle;
}
