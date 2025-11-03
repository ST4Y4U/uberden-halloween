// src/data/state.ts
export type Stats = { good: number; bad: number; played: number };
export type CarriedPie = {
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
  delivered?: boolean;
};

type GState = {
  stageId: number;
  stats: Stats;
  pie?: CarriedPie | null;
};

let _g: GState = { stageId: 1, stats: { good: 0, bad: 0, played: 0 }, pie: null };

export function getGameState(){ return _g; }
export function setGameState(s: GState){ _g = s; }
export function writeCarriedPie(p: CarriedPie){ _g.pie = p; }
export function readCarriedPie(){ return _g.pie ?? null; }
export function clearCarriedPie(){ _g.pie = null; }

export function recordEvaluation(ok: boolean){
  _g.stats.played++;
  if (ok) _g.stats.good++; else _g.stats.bad++;
}

export function advanceStage(){ _g.stageId = (_g.stageId ?? 1) + 1; }

export function computeEnding(): "good" | "normal" | "bad" {
  const { good, bad, played } = _g.stats;
  // 규칙: 실패 1개라도 있으면 노멀, 전부 실패면 배드, 그 외(실패 0) 굿
  if (bad >= played && played > 0) return "bad";
  if (bad >= 1) return "normal";
  return "good";
}
