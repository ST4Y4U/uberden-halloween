// src/data/state.ts
// 게임 전역 상태 관리 (로컬스토리지 + 메모리 분리)

export interface GameState {
  stageId: number;
  stats: {
    good: number;
    bad: number;
  };
}

export interface CarriedPie {
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
  delivered: boolean;
}

// ----------------------------
// 로컬스토리지 (영구 저장용)
// ----------------------------
const KEY = "astrash_state";

function _load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // 초기 상태
  return { stageId: 1, stats: { good: 0, bad: 0 } };
}

function _save(g: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {}
}

// ----------------------------
// 파이 상태 (비영구, 메모리 전용)
// ----------------------------
let _volatilePie: CarriedPie | null = null;

export function writeCarriedPie(pie: CarriedPie) {
  _volatilePie = { ...pie };
}

export function readCarriedPie(): CarriedPie | null {
  return _volatilePie ? { ..._volatilePie } : null;
}

export function clearCarriedPie() {
  _volatilePie = null;
}

// ----------------------------
// 일반 전역 상태
// ----------------------------
export function getGameState(): GameState {
  return _load();
}

export function setGameState(g: GameState) {
  _save(g);
}

// ----------------------------
// 스테이지 관리
// ----------------------------
export function advanceStage() {
  const g = _load();
  g.stageId++;
  _save(g);
}

export function recordEvaluation(ok: boolean) {
  const g = _load();
  if (ok) g.stats.good++;
  else g.stats.bad++;
  _save(g);
}

// ----------------------------
// 엔딩 계산 로직
// ----------------------------
export function computeEnding(): "good" | "normal" | "bad" {
  const g = _load();
  if (g.stats.good >= 5) return "good";
  if (g.stats.good >= 2) return "normal";
  return "bad";
}