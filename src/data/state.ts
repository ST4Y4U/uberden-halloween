// src/data/state.ts
// ✔ 비영구(in-memory) 상태. 새로고침하면 초기화됨.

export type CarriedPie = {
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
  delivered: boolean;
};

export type GameState = {
  stageId: number;               // 현재 스테이지 (1..7)
  pie: CarriedPie | null;        // 홀로 들고 나갈 파이
  stats: { good: number; bad: number }; // 성공/실패 집계
};

// ---- 내부 메모리 ----
let _g: GameState = {
  stageId: 1,
  pie: null,
  stats: { good: 0, bad: 0 },
};

// ---- 파이 캐리 전용 API ----
export function writeCarriedPie(pie: CarriedPie) {
  _g.pie = { ...pie };
}
export function readCarriedPie(): CarriedPie | null {
  return _g.pie ? { ..._g.pie } : null;
}
export function clearCarriedPie(): void {
  _g.pie = null;
}

// ---- 게임 상태 통째로 접근(필요시) ----
export function getGameState(): GameState {
  // 얕은 방어 복사
  return {
    stageId: _g.stageId,
    pie: _g.pie ? { ..._g.pie } : null,
    stats: { ..._g.stats },
  };
}
export function setGameState(s: Partial<GameState>) {
  // 필요한 필드만 갱신
  if (typeof s.stageId === "number") _g.stageId = s.stageId;
  if (s.pie !== undefined) _g.pie = s.pie ? { ...s.pie } : null;
  if (s.stats) _g.stats = { ..._g.stats, ...s.stats };
}

// ---- 평가/진행/엔딩 ----
export function recordEvaluation(ok: boolean) {
  if (ok) _g.stats.good++;
  else _g.stats.bad++;
}
export function advanceStage() {
  _g.stageId = Math.min(_g.stageId + 1, 7);
}
export function computeEnding(): "good" | "normal" | "bad" {
  const g = _g.stats.good;
  if (g >= 5) return "good";
  if (g >= 3) return "normal";
  return "bad";
}