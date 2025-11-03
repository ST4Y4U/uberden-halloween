export type Choice = {
  label: string;
  next: string;
};

export type Line = {
  who: "client" | "player";
  text: string;
  sprite?: string;
};

export type DialogNode = {
  id: string;
  who: "client";
  text: string;
  sprite?: string;
  choices?: Choice[];
};

export type OrderRule = {
  filling?: string;
  needsLattice?: boolean;
  toppings?: string[];
  ignoreLattice?: boolean;
  ignoreToppings?: boolean;
  successText?: string;
  failText?: string;
};

export type Customer = {
  id: string;
  name?: string;
  sprites: {
    standard: string;
    happy?: string;
    angry?: string;
    [key: string]: string; // sprite 확장 허용
  };
  preDialogue?: Line[];
  dialogue?: DialogNode[];
  order?: OrderRule;
  successLine?: Line;
  failLine?: Line;
  deliver?: { success?: string; fail?: string };
  dialogueOutcome?: { success?: string; fail?: string };
  endingLine?: Line;
};

export type StageData = {
  id: number;
  name?: string;
  bakeTimeSec?: number;
  magicUnlocked?: boolean;
  nextStage?: number;
  endGame?: boolean; // 엔딩 여부
  ui?: {
    arrowToKitchen?: { x: number; y: number };
    arrowToHall?: { x: number; y: number };
  };
  layout?: any; // 구조 복잡해서 any로 둠 (필요하면 세분화 가능)
  customers: Customer[];
  epilogueSuccess?: Line[];
  epilogueFail?: Line[];
};

export async function loadStageData(id: number): Promise<StageData> {
  // 🔧 절대경로 대신 상대경로 혹은 Vite 기준 public 경로
  const path = `/uberden-halloween/assets/data/stage0${id}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`stage json ${id} 404`);
  return (await res.json()) as StageData;
}