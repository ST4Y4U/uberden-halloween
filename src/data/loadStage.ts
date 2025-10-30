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

// ✅ Vite의 BASE_URL을 이용하면 로컬/깃허브페이지 모두 안전
const BASE = (import.meta as any).env?.BASE_URL ?? "/";

export async function loadStageData(stageId:number): Promise<StageData> {
  const name = `stage0${stageId}.json`;
  // 1순위: public/assets/data
  const p1 = `${BASE}assets/data/${name}`;
  // 2순위: public/data (혹시 이전 구조가 남아있을 때 대비)
  const p2 = `${BASE}data/${name}`;

  try { return await fetchJson(p1); }
  catch { return await fetchJson(p2); }
}
