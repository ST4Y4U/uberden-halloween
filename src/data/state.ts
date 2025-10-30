// src/data/state.ts
export interface PieState {
  hasDough: boolean;
  cooked: boolean;
  filling: string | null;     // "pie_jam_apple" 등
  lattice: boolean;
  toppings: string[];         // ["pie_ingredient_..."]
}

export interface KitchenState {
  pieState?: PieState | null; // 현재 도마 위 파이 상태
  pieReady?: boolean;         // 홀 프리뷰용 플래그
}

export interface ScoreSummary {
  total: number;
  good: number;
  bad: number;
}

export interface GameState {
  stageId: number;            // 현재 스테이지 (1~7)
  kitchen?: KitchenState;
  result?: "good" | "normal" | "bad";
}

let current: GameState = {
  stageId: 1,
  kitchen: { pieState: null, pieReady: false }
};

export function getGameState(): GameState {
  return current;
}

export function setGameState(s: GameState) {
  current = s;
}

export function setPieState(pie: PieState | null, ready = false) {
  current.kitchen = current.kitchen || {};
  current.kitchen.pieState = pie;
  current.kitchen.pieReady = ready;
}

export function nextStage() {
  current.stageId = Math.min((current.stageId ?? 1) + 1, 7);
  // 홀/주방 루프 안정화를 위해 파이 상태 초기화
  setPieState(null, false);
}
