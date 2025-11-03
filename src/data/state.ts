// src/data/state.ts
export type CarriedPie = {
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
  delivered?: boolean;
};

export type GameStats = { good: number; bad: number };

export type GameState = {
  stageId: number;
  pie?: CarriedPie | null;
  stats: GameStats;
};

// ---- 비영구(in-memory) 저장소 ----
let _state: GameState = { stageId: 1, pie: null, stats: { good: 0, bad: 0 } };

export function getGameState(): GameState {
  return _state;
}
export function setGameState(s: GameState) {
  _state = s;
}

// 편의 함수
export function readCarriedPie(): CarriedPie | null {
  const g = getGameState();
  return g.pie ?? null;
}
export function setCarriedPie(p: CarriedPie | null) {
  const g = getGameState();
  g.pie = p;
  setGameState(g);
}
export function clearCarriedPie() {
  const g = getGameState();
  g.pie = null;
  setGameState(g);
}
export function recordEvaluation(ok: boolean) {
  const g = getGameState();
  if (ok) g.stats.good++;
  else g.stats.bad++;
  setGameState(g);
}
export function advanceStage() {
  const g = getGameState();
  g.stageId = Math.max(1, (g.stageId || 1) + 1);
  setGameState(g);
}
export function computeEnding(): "good" | "normal" | "bad" {
  const { good, bad } = getGameState().stats;
  if (good >= bad + 2) return "good";
  if (bad >= good + 2) return "bad";
  return "normal";
}