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
  console.log("[stage json try]", url);
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}

// ✅ baseURI를 기준으로 항상 public/ 기준 경로를 만듦
function urlFromBase(path: string): string {
  return new URL(path.replace(/^\/+/, ""), document.baseURI).toString();
}

export async function loadStageData(stageId:number): Promise<StageData> {
  const name = `stage0${stageId}.json`;
  // 1순위: public/assets/data
  const p1 = urlFromBase(`assets/data/${name}`);
  // 2순위: public/data (예전 구조 호환)
  const p2 = urlFromBase(`data/${name}`);

  try { return await fetchJson(p1); }
  catch (e1) {
    console.warn("[stage json fallback]", e1);
    return await fetchJson(p2);
  }
}
