// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, CustomerData } from "../data/loadStage.ts";
import { getGameState, setGameState, setPieState, nextStage } from "../data/state.ts";

const AUTO_JUDGE_ON_ENTER = false;  // 홀 입장 즉시 판정
const SILENT_JUDGE = true;         // 대사 없이 판정만

export default class Hall extends Phaser.Scene {
  private stageData!: StageData;
  private customer!: CustomerData;
  private client!: Phaser.GameObjects.Image;

  constructor() { super("Hall"); }

  preload() {
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter", "assets/images/hall_counter.png");
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");

    // 손님 스프라이트(필요한 것만)
    const names = ["levin","cheongbi","liora","lorica","sonya","hide"];
    for (const n of names) {
      this.load.image(`client_${n}_standard`, `assets/images/client_${n}_standard.png`);
      this.load.image(`client_${n}_happy`,    `assets/images/client_${n}_happy.png`);
      this.load.image(`client_${n}_angry`,    `assets/images/client_${n}_angry.png`);
      this.load.image(`client_${n}_changed`,  `assets/images/client_${n}_changed.png`);
    }

    // 파이 프리뷰용 리소스(Stage에서 이미 로드했다면 중복 무시됨)
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);

    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle", "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");
  }

  create() {
    this.add.image(640, 360, "hall_background").setDepth(-1000);
    this.add.image(640, 360, "hall_counter").setDepth(10);

    const gs = getGameState();
    const stageId = gs.stageId ?? 1;

    // 스테이지 JSON 로드 (에러 시 화면 표시)
    try {
      this.stageData = await loadStageData(stageId);
    } catch (e: any) {
      this.add.text(640, 360,
        `스테이지 데이터 로드 실패\n${e?.message ?? e}`,
        { fontFamily:"sans-serif", fontSize:"22px", color:"#F7E2B2", align:"center", wordWrap:{width:900} }
      ).setOrigin(0.5).setDepth(9999);
      return;
    }

    this.customer = this.stageData.customers[0];

    // 손님 위치
    const H = this.stageData.layout?.hall ?? {};
    const cx = H.standX ?? 491, cy = H.standY ?? 298;
    const clientTex = this.customer?.sprites?.standard || "client_levin_standard";
    this.client = this.add.image(cx, cy, clientTex).setDepth(15);

    // 도마 + 파이 프리뷰 (항상 표시)
    this.add.image(720, 625, "pie_cuttingboard").setDepth(20);
    const K = gs.kitchen;
    const P = K?.pieState;

    if (P?.hasDough) {
      this.add.image(720, 625, P.cooked ? "pie_bottom_cooked" : "pie_bottom_raw").setDepth(21);
      if (P.filling) this.add.image(720, 625, P.filling).setDepth(22);
      if (P.lattice) this.add.image(720, 625, P.cooked ? "pie_top_cooked" : "pie_top_raw").setDepth(23);
      if (Array.isArray(P.toppings)) {
        let z = 24;
        for (const t of P.toppings) this.add.image(720, 625, t).setDepth(z++);
      }
    }

    // 주방 이동 화살표(좌하단)
    this.add.image(60, 640, "hall_arrow").setDepth(30).setInteractive({useHandCursor:true})
      .on("pointerup", () => this.scene.start("Stage"));


  }

  private runJudgeFlow() {
    const gs = getGameState();
    const stage = this.stageData;
    const C = this.customer;
    const pie = gs.kitchen?.pieState;

    // 조건 계산
    const isFinal = stage?.id === 7;

    let ok = false;
    if (pie && pie.cooked) {
      const o = C.order || {};
      const fillingOk = isFinal ? (pie.filling === "pie_jam_magic") : (pie.filling === o.filling);
      const latticeOk  = isFinal ? true : (o.ignoreLattice || pie.lattice === o.needsLattice);
      const toppingOk  = isFinal ? true : (o.ignoreToppings || (!o.toppings || o.toppings.every(t => pie.toppings.includes(t))));
      ok = fillingOk && latticeOk && toppingOk;
    }

    // 통계/흐름 처리(대사 없이)
    // 결과 기록(최종 엔딩용)
    gs.result = ok ? "good" : "bad";
    setGameState(gs);

    if (stage.id === 7) {
      // 최종 스테이지 → 엔딩
      this.scene.start("Result");
    } else {
      // 다음 스테이지로
      nextStage(); // stageId++, pie 초기화
      this.scene.start("Hall");
    }
  }
}
