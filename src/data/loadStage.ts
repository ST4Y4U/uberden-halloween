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

async function tryFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch fail ${res.status} ${url}');
  return res.json();
}

export async function loadStageData(stageId: number): Promise<StageData> {
  const name = 'stage0${stageId}.json';
  try { return await tryFetch('assets/data/${name}'); } catch {}
}
