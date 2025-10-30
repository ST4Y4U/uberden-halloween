// src/data/loadStage.ts
export interface Line { who:"client"|"player"; text:string; sprite?:string }
export interface OrderSpec { filling?:string; needsLattice?:boolean; toppings?:string[]; ignoreLattice?:boolean; ignoreToppings?:boolean; exactMatch?:boolean }
export interface CustomerData { id:string; sprites:Record<string,string>; order?:OrderSpec; successLine?:Line|Line[]; failLine?:Line|Line[] }
export interface StageData {
  id:number; name:string; bakeTimeSec?:number;
  preface?:Line[]; epilogueSuccess?:Line[]; epilogueFail?:Line[];
  layout?:{ hall?:{ standX?:number; standY?:number }; kitchen?:any };
  customers: CustomerData[];
}

async function fetchJson(url:string){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}

// ✅ Vite BASE_URL 기반으로 동작
const BASE = (import.meta as any).env?.BASE_URL ?? "/";

export async function loadStageData(stageId:number): Promise<StageData> {
  const name = `stage0${stageId}.json`;
  const p1 = `${BASE}assets/data/${name}`;   // ✅ 1순위: public/assets/data
  const p2 = `${BASE}data/${name}`;           // 2순위: public/data (옛 구조 대비)
  try { return await fetchJson(p1); }
  catch { return await fetchJson(p2); }
}
