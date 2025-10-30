// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, CustomerData, Line } from "../data/loadStage";
import { getGameState, setGameState } from "../data/state";

export default class Hall extends Phaser.Scene {
  private stageData!: StageData;
  private customer!: CustomerData;
  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;
  private textboxText!: Phaser.GameObjects.Text;
  private myTextboxText!: Phaser.GameObjects.Text;
  private deliverRect!: Phaser.Geom.Rectangle;
  private deliverDebug?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("Hall");
  }

  preload() {
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter", "assets/images/hall_counter.png");
    this.load.image("hall_textbox", "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox", "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");

    // 모든 손님 스프라이트
    const names = ["levin", "cheongbi", "l iora", "lorica", "sonya", "hide"];
    for (const n of names) {
      this.load.image(`client_${n}_standard`, `assets/images/client_${n}_standard.png`);
      this.load.image(`client_${n}_happy`, `assets/images/client_${n}_happy.png`);
      this.load.image(`client_${n}_angry`, `assets/images/client_${n}_angry.png`);
    }
  }

  async create() {
    this.add.image(640, 360, "hall_background").setDepth(-1000);
    this.add.image(640, 360, "hall_counter").setDepth(10);

    const state = getGameState();
    const stageId = state.stageId ?? 1;

    this.stageData = await loadStageData(stageId);
    this.customer = this.stageData.customers[0];

    // 손님 스프라이트
    const clientTex = this.customer?.sprites?.standard || "client_levin_standard";
    this.client = this.add.image(491, 298, clientTex).setDepth(5);
    this.updateDeliverZoneFromClient(0.9); // ← 손님 기준 배달 영역 자동 계산

    // 대화 박스
    this.textbox = this.add.image(960, 305, "hall_textbox").setDepth(20).setVisible(false);
    this.textboxText = this.add.text(775, 205, "", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#140605",
      wordWrap: { width: 620 }
    }).setDepth(21).setVisible(false);

    // 플레이어 박스
    this.myTextbox = this.add.image(325, 550, "hall_mytextbox").setDepth(22).setVisible(false);
    this.myTextboxText = this.add.text(125, 483, "", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#F7E2B2",
      wordWrap: { width: 540 }
    }).setDepth(23).setVisible(false);

    // 주방 이동 화살표 (왼쪽 구석)
    this.toKitchenArrow = this.add.image(60, 640, "hall_arrow")
      .setDepth(30)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 도마/파이 재현
    const kitchenState = state.kitchen;
    if (kitchenState?.pieReady) {
      this.add.image(720, 625, "pie_cuttingboard").setDepth(15);
      const pieKey = kitchenState.pieKey ?? "pie_bottom_cooked";
      this.add.image(720, 625, pieKey).setDepth(16);
    }

    // 초기 대화 시작
    this.startDialogueSequence();
  }

  private updateDeliverZoneFromClient(scale: number = 1.0) {
    const b = this.client.getBounds();
    const w = b.width * scale;
    const h = b.height * scale;
    const cx = b.centerX;
    const cy = b.centerY;
    this.deliverRect = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
    if (this.deliverDebug) this.deliverDebug.destroy();
    // 디버그용 박스 (확인 시 주석 해제)
    // this.deliverDebug = this.add.rectangle(cx, cy, w, h, 0x00ff00, 0.2).setDepth(2);
  }

  private startDialogueSequence() {
    const lines = this.stageData.preface || [
      { who: "client", text: "이봐, 주문 좀 받을 수 있을까?" },
      { who: "player", text: "물론입니다. 무엇을 드릴까요?" }
    ];
    this.playLines(lines, 0);
  }

  private playLines(lines: Line[], index: number) {
    if (index >= lines.length) {
      this.textbox.setVisible(false);
      this.textboxText.setVisible(false);
      this.myTextbox.setVisible(false);
      this.myTextboxText.setVisible(false);
      return;
    }

    const line = lines[index];
    const isClient = line.who === "client";

    if (isClient) {
      this.textbox.setVisible(true);
      this.textboxText.setText(line.text).setVisible(true);
      this.myTextbox.setVisible(false);
      this.myTextboxText.setVisible(false);
    } else {
      this.myTextbox.setVisible(true);
      this.myTextboxText.setText(line.text).setVisible(true);
      this.textbox.setVisible(false);
      this.textboxText.setVisible(false);
    }

    this.input.once("pointerup", () => this.playLines(lines, index + 1));
  }

  private runJudgeFlow() {
    const state = getGameState();
    const stage = this.stageData;
    const C = this.customer;
    const pie = state.kitchen?.pieState;
    if (!pie || !pie.cooked) {
      const lines: Line[] = [C?.failLine ?? { who: "client", text: "…아직 준비가 안 된 모양이군." }];
      if (stage.epilogueFail) lines.push(...stage.epilogueFail);
      this.playLinesThenResult(lines, false);
      return;
    }

    const o = C.order || {};
    const isFinal = stage?.id === 7;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic") : (pie.filling === o.filling);
    const latticeOk = o.ignoreLattice || pie.lattice === o.needsLattice || (isFinal && o.ignoreLattice === true);
    const toppingOk = o.ignoreToppings || (o.toppings ? o.toppings.every((t: string) => pie.toppings.includes(t)) : true) || (isFinal && o.ignoreToppings === true);

    const ok = pie.cooked && fillingOk && latticeOk && toppingOk;

    // ✅ 대사 없이 “판정만” 하고 바로 전환
    this.hideBoxes(); // 혹시 열려 있던 말풍선/텍스트 정리

    const summary = this.registry.get("scoreSummary") || { total: 0, good: 0, bad: 0 };
    summary.total += 1;
    if (ok) summary.good += 1; else summary.bad += 1;
    this.registry.set("scoreSummary", summary);

// 다음 흐름 결정
    const isLast = (this.stageData?.id === 7);
    if (isLast) {
      this.scene.start("Result");        // 엔딩 씬으로
    } else {
      const nextStage = (this.stageData?.id || 1) + 1;
      this.registry.set("currentStage", nextStage);
      this.registry.set("pieState", null);
      this.scene.start("Hall");          // 다음 스테이지로
    }
  }

  private playLinesThenResult(lines: Line[], success: boolean) {
    this.playLines(lines, 0);
    this.time.delayedCall(lines.length * 1800, () => {
      const state = getGameState();
      state.result = success ? "good" : "bad";
      setGameState(state);
      this.scene.start("Result");
    });
  }
}
