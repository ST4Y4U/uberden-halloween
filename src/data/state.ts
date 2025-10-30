// src/data/state.ts
export interface KitchenState {
  pieReady: boolean;
  pieKey?: string;
  pieState?: any;
}

export interface GameState {
  stageId: number;
  kitchen?: KitchenState;
  result?: string;
}

let currentState: GameState = { stageId: 1 };

export function getGameState(): GameState {
  return currentState;
}

export function setGameState(s: GameState) {
  currentState = s;
}
