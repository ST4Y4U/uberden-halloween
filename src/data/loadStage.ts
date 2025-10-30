export type Choice = { label: string; next: string };
export type Line = { who: "client" | "player"; text: string; sprite?: "standard" | "happy" | "angry" };
export type DialogNode = { id: string; who: "client"; text: string; sprite?: "standard" | "happy" | "angry"; choices: Choice[] };

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
  sprites: { standard: string; happy?: string; angry?: string };
  preDialogue?: Line[];
  dialogue?: DialogNode[];
  order?: OrderRule;
  successLine?: Line;
  failLine?: Line;
};

export type StageData = {
  id: number;
  name?: string;
  ui?: { arrowToKitchen?: { x: number; y: number }; arrowToHall?: { x: number; y: number } };
  customers: Customer[];
  epilogueSuccess?: Line[];
  epilogueFail?: Line[];
};

export async function loadStageData(id: number): Promise<StageData> {
  const path = `/uberden-halloween/assets/data/stage0${id}.json`;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`stage json ${id} 404`);
  return (await res.json()) as StageData;
}
