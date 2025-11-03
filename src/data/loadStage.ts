// src/data/loadStage.ts

// 말풍선에 쓸 스프라이트 키(스테이지7에서 'changed','anxious'도 쓰므로 포함)
export type FaceKey = "standard" | "happy" | "angry" | "changed" | "anxious" | (string & {});
export type Choice = { label: string; next: string };
export type Line = { who: "client" | "player"; text: string; sprite?: FaceKey };
export type DialogNode = { id: string; who: "client"; text: string; sprite?: FaceKey; choices?: Choice[] };

export type OrderRule = {
  filling?: string;
  needsLattice?: boolean;
  toppings?: string[];
  ignoreLattice?: boolean;
  ignoreToppings?: boolean;
};

export type Customer = {
  id: string;
  name?: string;
  sprites: Record<FaceKey, string>;
  preDialogue?: Line[];
  dialogue?: DialogNode[];
  order?: OrderRule;
  successLine?: Line;
  failLine?: Line;
  deliver?: { success?: string; fail?: string }; // 여유 슬롯
};

export type StageData = {
  id: number;
  name?: string;
  ui?: { arrowToKitchen?: { x: number; y: number }; arrowToHall?: { x: number; y: number } };
  layout?: {
    hall?: { deliverZone?: { x: number; y: number; w: number; h: number } };
    kitchen?: unknown;
  };
  customers: Customer[];
  epilogueSuccess?: Line[];
  epilogueFail?: Line[];
  endGame?: boolean; // 스테이지 7에서 true
};

// GitHub Pages 같은 루트 기준 경로
export async function loadStageData(id: number): Promise<StageData> {
  const path = `/uberden-halloween/assets/data/stage0${id}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`stage json ${id} 404`);
  return (await res.json()) as StageData;
}