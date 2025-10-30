// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, Line, DialogNode } from "../data/loadStage";
import { getGameState, recordEvaluation, advanceStage, computeEnding } from "../data/state";

// 🎯 위치 수동 지정
const POS = {
  background: { x: 640, y: 360 },
  counter: { x: 640, y: 360 },
  client: { x: 320, y: 420 },
  textboxClient: { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer: { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen: { x: 120, y: 640 }
};

export default class Hall extends Phaser.Scene {
  constructor() { super("Hall"); }

  private stageData!: StageData;

  private client!: Phaser.GameObjects.Image;
  private clBox!: Phaser.GameObjects.Image;
  private myBox!: Phaser.GameObjects.Image;
  private clText!: Phaser.GameObjects.Text;
  private myText!: Phaser.GameObjects.Text;
  private choiceA?: Phaser.GameObjects.Text;
  private choiceB?: Phaser.GameObjects.Text;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  private dialogQueue: Line[] = [];
  private awaitingChoice = false;

  async create(data: any) {
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경 및 기본 레이아웃
    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(-1000);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(10);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(12);

    // 말풍선 및 텍스트
    this.clBox = this.add.image(POS.textboxClient.x, POS.textboxClient.y, "hall_textbox")
      .setDepth(20).setVisible(false).setInteractive({ useHandCursor: true });
    this.myBox = this.add.image(POS.textboxPlayer.x, POS.textboxPlayer.y, "hall_mytextbox")
      .setDepth(21).setVisible(false).setInteractive({ useHandCursor: true });

    this.clText = this.add.text(POS.textboxClient.textX, POS.textboxClient.textY, "", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#140605",
      wordWrap: { width: 500 },   // ← 여기 값 줄바꿈 폭
      lineSpacing: 6              // ← 줄 간격
    }).setDepth(31).setVisible(false);

    this.myText = this.add.text(POS.textboxPlayer.textX, POS.textboxPlayer.textY, "", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#F7E2B2",
      wordWrap: { width: 460 },   // ← 플레이어 줄바꿈 폭
      lineSpacing: 8
    }).setDepth(32).setVisible(false);

    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    // 주방으로 이동 화살표
    this.toKitchenArrow = this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(40).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 전달 판정이 넘어왔다면 즉시 평가
    if (data && typeof data.deliverOk === "boolean") {
      this.onDeliverEvaluated(data.deliverOk);
      return;
    }

    // 프리대화 → 주문 전환
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who: "client", text: "" } as any];
    this.showNextFromQueue();
  }

  private getClientSprite(face: "standard" | "happy" | "angry" = "standard") {
    const C = this.stageData.customers?.[0];
    const s = C?.sprites || {};
    return s[face] || "client_levin_standard";
  }

  private showNextFromQueue() {
    if (this.awaitingChoice) return;
    const next: any = this.dialogQueue.shift();
    if (!next) { this.beginOrderDialogue(); return; }
    if (!next.text) { this.beginOrderDialogue(); return; }

    if (next.sprite) this.client.setTexture(this.getClientSprite(next.sprite));
    const who = next.who === "player" ? "player" : "client";
    if (who === "client") {
      this.myBox.setVisible(false); this.myText.setVisible(false);
      this.clBox.setVisible(true); this.clText.setVisible(true).setText(next.text);
    } else {
      this.clBox.setVisible(false); this.clText.setVisible(false);
      this.myBox.setVisible(true); this.myText.setVisible(true).setText(next.text);
    }
  }

  private beginOrderDialogue() {
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    if (!dlg.length) { this.hideBubbles(); return; }
    const first = dlg.find(n => n.id === "d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id: string) {
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    const node = dlg.find(n => n.id === id);
    if (!node) { this.hideBubbles(); return; }

    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);
    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));

    this.destroyChoices();
    const cs = node.choices || [];
    if (!cs.length) return;
    this.awaitingChoice = true;

    const makeChoice = (label: string, nextId: string, offset: number) => {
      const t = this.add.text(640 + offset, 640, label, {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#F7E2B2",
        backgroundColor: "#6E2B8B"
      }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });
      t.on("pointerup", () => {
        this.awaitingChoice = false; this.destroyChoices();
        if (nextId === "end") { this.hideBubbles(); }
        else this.playDialogNode(nextId);
      });
      return t;
    };
    if (cs[0]) this.choiceA = makeChoice(cs[0].label, cs[0].next, -160);
    if (cs[1]) this.choiceB = makeChoice(cs[1].label, cs[1].next, +160);
  }

  private destroyChoices() {
    this.choiceA?.destroy(); this.choiceB?.destroy();
    this.choiceA = undefined; this.choiceB = undefined;
  }

  private hideBubbles() {
    this.clBox.setVisible(false); this.clText.setVisible(false);
    this.myBox.setVisible(false); this.myText.setVisible(false);
  }

  private advance() {
    if (!this.awaitingChoice) this.showNextFromQueue();
  }

  public onDeliverEvaluated(ok: boolean) {
    recordEvaluation(오케이);
    const last = getGameState().stageId;
    if (last >= 7) {
      const result = computeEnding();
      this.scene.start("Result", { result });
      return;
    }
    advanceStage();
    this.scene.start("Hall");
  }
}
