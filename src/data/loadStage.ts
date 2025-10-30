// src/data/loadStage.ts
export interface Line {
  who: "client" | "player";
  text: string;
  sprite?: string; // 선택: 대사 중 스프라이트 전환용
}

export interface OrderSpec {
  filling?: string;              // e.g. "pie_jam_apple"
  needsLattice?: boolean;
  toppings?: string[];           // e.g. ["pie_ingredient_sugarpowder"]
  ignoreLattice?: boolean;
  ignoreToppings?: boolean;
  exactMatch?: boolean;
}

export interface CustomerData {
  id: string;                    // "c1" ~ "c7"
  sprites: Record<string, string>; // {standard, happy, angry, ...}
  order?: OrderSpec;
  successLine?: Line | Line[];   // Hall에서 “대사 모드”일 때 사용
  failLine?: Line | Line[];      // (지금은 SILENT이므로 출력 안 함)
}

export interface StageData {
  id: number;                    // 1 ~ 7
  name: string;
  bakeTimeSec?: number;

  // 선택: 프리 대화, 에필로그(성공/실패)
  preface?: Line[];
  epilogueSuccess?: Line[];
  epilogueFail?: Line[];

  layout?: {
    hall?: {
      standX?: number;
      standY?: number;
      // deliverZone은 자동 계산하므로 필요 없음
    };
    kitchen?: any; // 좌표를 JSON으로 쓸 경우용(선택)
  };

  customers: CustomerData[];
}

async function tryFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch fail ${res.status} ${url}`);
  return res.json();
}

export async function loadStageData(stageId: number): Promise<StageData> {
  const name = `stage0${stageId}.json`;
  // 먼저 /assets/data 시도
  try { return await tryFetch(`assets/data/${name}`); } catch {}
  // 다음 /data 시도
  try { return await tryFetch(`data/${name}`); } catch {}
  throw new Error(`Stage JSON not found: assets/data/${name} or data/${name}`);
}
