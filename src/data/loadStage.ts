// src/data/loadStage.ts
import Phaser from "phaser";

export interface Line {
  who: "client" | "player";
  text: string;
  sprite?: string;
}

export interface CustomerData {
  id: string;
  sprites: Record<string, string>;
  order?: {
    filling?: string;
    needsLattice?: boolean;
    toppings?: string[];
    ignoreLattice?: boolean;
    ignoreToppings?: boolean;
    exactMatch?: boolean;
  };
  successLine?: Line;
  failLine?: Line;
}

export interface StageData {
  id: number;
  name: string;
  customers: CustomerData[];
  preface?: Line[];
  epilogueSuccess?: Line[];
  epilogueFail?: Line[];
}

export async function loadStageData(stageId: number): Promise<StageData> {
  const res = await fetch(`data/stage0${stageId}.json`);
  if (!res.ok) throw new Error(`Stage JSON not found: ${stageId}`);
  return await res.json();
}
