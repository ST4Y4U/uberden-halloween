export type Stats = { good: number; bad: number };
export type CarriedPie = {
  delivered: any;
  cooked: boolean;
  filling: string | null;   // "pie_jam_apple"
  lattice: boolean;
  toppings: string[];       // ["pie_ingredient_cherry", ...]
};
export type GameState = {
  stageId: number;          // 1..7
  stats: Stats;
  pie?: CarriedPie;         // 홀로 들고 가는 파이
};

const KEY = "uberden_halloween_state";

function _load(): GameState {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch {}
  return { stageId: 1, stats: { good: 0, bad: 0 } };
}
function _save(g: GameState) { localStorage.setItem(KEY, JSON.stringify(g)); }

export function getGameState(): GameState { return _load(); }
export function setGameState(g: GameState) { _save(g); }

export function resetRun() {
  setGameState({ stageId: 1, stats: { good: 0, bad: 0 } });
}

export function recordEvaluation(ok: boolean) {
  const g = _load();

  g.stats ??= { good: 0, bad: 0 };

  if (ok) {
    g.stats.good = (g.stats.good ?? 0) + 1;
  } else {
    g.stats.bad  = (g.stats.bad  ?? 0) + 1;
  }

  _save(g);
}

export function clearCarriedPie() {
  const g = _load();
  delete g.pie;
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
  if (g.stats.bad === 0) return "good";
  if (g.stats.good === 0) return "bad";
  return "normal";
}
