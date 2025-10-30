// src/data/state.ts
export type Stats = { good: number; bad: number };
export type GameState = {
  stageId: number;          // 1..7
  stats: Stats;             // 누적 평가
};

const KEY = "uberden_halloween_state";

function _load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stageId: 1, stats: { good: 0, bad: 0 } };
}

function _save(g: GameState) {
  localStorage.setItem(KEY, JSON.stringify(g));
}

export function getGameState(): GameState { return _load(); }
export function setGameState(g: GameState) { _save(g); }

export function resetRun() {
  setGameState({ stageId: 1, stats: { good: 0, bad: 0 } });
}

export function recordEvaluation(ok: boolean) {
  const g = _load();
  if (오케이) g.stats.good++; else g.stats.bad++;
  _save(g);
}

export function advanceStage(): number {
  const g = _load();
  g.stageId = Math.min(7, g.stageId + 1);
  _save(g);
  return g.stageId;
}

export function computeEnding(): "good" | "normal" | "bad" {
  const g = _load();
  const total = g.stats.good + g.stats.bad;
  if (total === 0) return "normal";
  if (g.stats.bad === 0) return "good";          // 전부 성공
  if (g.stats.good === 0) return "bad";          // 전부 실패
  return "normal";                               // 섞였으면 노말
}
