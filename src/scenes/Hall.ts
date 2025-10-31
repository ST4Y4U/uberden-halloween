// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, Line, OrderRule } from "@/data/loadStage";
import { getGameState, clearCarriedPie, recordEvaluation, advanceStage, computeEnding } from "@/data/state";

const POS = {
  background:     { x: 640, y: 360 },
  counter:        { x: 640, y: 360 },
  client:         { x: 480, y: 290 },
  textboxClient:  { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer:  { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen:   { x: 1210, y: 625 },
  board:          { x: 720, y: 620 },
  hallPie:        { x: 720, y: 620 }
};

const PIE_OFFSET = { x: 0, y: -90 };
// 드래그 편의: 약간 큰 히트박스
const PIE_HIT    = { w: 360, h: 240, dragOffsetX: 40 };

const DEPTH = {
  BG: -1000,
  CLIENT: 10,
  COUNTER: 12,
  BOARD: 13,
  PIE: 40,      // 말풍선보다 위로
  UI: 30,
  CHOICE: 50
};

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

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

  private hallBoard!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;

  private deliverRect!: Phaser.Geom.Rectangle;
  private deliveredLocked = false; // 중복 판정 방지

  preload() {
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter",    "assets/images/hall_counter.png");
    this.load.image("hall_arrow",      "assets/images/hall_arrow.png");

    this.load.image("hall_textbox",    "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",  "assets/images/hall_mytextbox.png");

    this.load.image("client_levin_standard","assets/images/client_levin_standard.png");
    this.load.image("client_levin_happy",   "assets/images/client_levin_happy.png");
    this.load.image("client_levin_angry",   "assets/images/client_levin_angry.png");

    this.load.image("pie_cuttingboard",      "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_cooked",     "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_cooked",        "assets/images/pie_top_cooked.png");

    this.load.image("pie_jam_apple",         "assets/images/pie_jam_apple.png");
    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle","assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder","assets/images/pie_ingredient_sugarpowder.png");
  }

  async create() {
    const G = getGameState();

    // 새로고침 등으로 들어왔는데, 미납품 파이가 남아있다면 제거(요구사항)
    if (G.pie && !G.pie.delivered) {
      clearCarriedPie();
    }

    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    // 도마는 상시
    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard")
      .setOrigin(0.5).setDepth(DEPTH.BOARD).setVisible(true);

    // 납품 영역(손님 바운딩 박스 기반 축소 + 오른쪽으로 약간 이동)
    {
      const cb = this.client.getBounds();
      const cx = cb.x + cb.width * 0.5 + 40; // →40 쉬프트
      const cy = cb.y + cb.height * 0.5;
      this.deliverRect = new Phaser.Geom.Rectangle(
        cx - cb.width  * 0.35,
        cy - cb.height * 0.30,
        cb.width  * 0.70,
        cb.height * 0.60
      );
    }

    this.clBox = this.add.image(POS.textboxClient.x, POS.textboxClient.y, "hall_textbox")
      .setDepth(DEPTH.UI).setVisible(false).setInteractive({ useHandCursor:true });
    this.myBox = this.add.image(POS.textboxPlayer.x, POS.textboxPlayer.y, "hall_mytextbox")
      .setDepth(DEPTH.UI+1).setVisible(false).setInteractive({ useHandCursor:true });

    this.clText = this.add.text(POS.textboxClient.textX, POS.textboxClient.textY, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#140605", wordWrap:{ width: 420 }, lineSpacing: 6
    }).setDepth(DEPTH.UI+2).setVisible(false);

    this.myText = this.add.text(POS.textboxPlayer.textX, POS.textboxPlayer.textY, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", wordWrap:{ width: 420 }, lineSpacing: 8
    }).setDepth(DEPTH.UI+3).setVisible(false);

    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    this.toKitchenArrow = this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 들고 온 파이 복원
    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
    }

    // 파이를 들고 온 경우엔 주문 대사 스킵
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    if (!G.pie?.cooked) {
      this.dialogQueue = [...pre, { who: "client", text: "" } as any];
      this.showNextFromQueue();
    } else {
      this.hideBubbles();
    }
  }

  private getClientSprite(face: "standard" | "happy" | "angry" = "standard"): string {
    const C: any = this.stageData.customers?.[0];
    const s = (C?.sprites ?? {}) as Record<string, string>;
    return s[face] || "client_levin_standard";
  }

  private showNextFromQueue(){
    if (this.awaitingChoice) return;
    const next: any = this.dialogQueue.shift();
    if (!next) { this.beginOrderDialogue(); return; }
    if (!next.text) { this.beginOrderDialogue(); return; }

    if (next.sprite) this.client.setTexture(this.getClientSprite(next.sprite));
    if (next.who === "player") {
      this.clBox.setVisible(false); this.clText.setVisible(false);
      this.myBox.setVisible(true);  this.myText.setVisible(true).setText(next.text);
    } else {
      this.myBox.setVisible(false); this.myText.setVisible(false);
      this.clBox.setVisible(true);  this.clText.setVisible(true).setText(next.text);
    }
  }

  private beginOrderDialogue(){
    const dlg: any[] = (this.stageData.customers?.[0]?.dialogue ?? []) as any[];
    if (!dlg.length){ this.hideBubbles(); return; }
    const first = dlg.find(n=>n.id==="d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id: string){
    const dlg: any[] = (this.stageData.customers?.[0]?.dialogue ?? []) as any[];
    const node: any = dlg.find(n=>n.id===id);
    if (!node){ this.hideBubbles(); return; }

    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);
    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));

    this.destroyChoices();
    const cs: any[] = node.choices || [];
    if (!cs.length) return;
    this.awaitingChoice = true;

    const makeChoice = (label: string, nextId: string, offset: number)=>{
      const t = this.add.text(640 + offset, 640, label, {
        fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", backgroundColor:"#6E2B8B"
      }).setOrigin(0.5).setDepth(DEPTH.CHOICE).setInteractive({ useHandCursor:true });
      t.on("pointerup", ()=>{
        this.awaitingChoice = false; this.destroyChoices();
        if (nextId === "end") { this.hideBubbles(); }
        else this.playDialogNode(nextId);
      });
      return t;
    };
    if (cs[0]) this.choiceA = makeChoice(cs[0].label, cs[0].next, -160);
    if (cs[1]) this.choiceB = makeChoice(cs[1].label, cs[1].next, +160);
  }

  private destroyChoices(){
    this.choiceA?.destroy();
    this.choiceB?.destroy();
    this.choiceA = undefined;
    this.choiceB = undefined;
  }

  private hideBubbles(){
    this.clBox.setVisible(false);
    this.clText.setVisible(false);
    this.myBox.setVisible(false);
    this.myText.setVisible(false);
  }

  private advance(){
    if (!this.awaitingChoice) this.showNextFromQueue();
  }

  private getOutcomeText(type: "success" | "fail"): string {
    const C: any = this.stageData.customers?.[0] ?? {};
    if (type === "success" && C.successLine?.text) return String(C.successLine.text);
    if (type === "fail"    && C.failLine?.text)    return String(C.failLine.text);
    if (type === "success" && C.deliver?.success)  return String(C.deliver.success);
    if (type === "fail"    && C.deliver?.fail)     return String(C.deliver.fail);
    return type === "success" ? "좋아. 딱 원하던 파이야." : "…이건 주문이 아니야.";
  }

  private getOutcomeSprite(type: "success" | "fail"): "happy" | "angry" | "standard" {
    const C: any = this.stageData.customers?.[0] ?? {};
    const key: any = (type === "success" ? C.successLine?.sprite : C.failLine?.sprite);
    if (key === "happy" || key === "angry" || key === "standard") return key;
    return type === "success" ? "happy" : "angry";
  }

  private spawnHallPie(filling: string | null, lattice: boolean, toppings: string[]){
    this.hallPieGroup?.destroy();

    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) {
      g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t));
    }

    // 드래그 핸들러(히트박스 오른쪽으로 약간 치우치게)
    const rX = -PIE_HIT.w/2 + PIE_HIT.dragOffsetX;
    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(new Phaser.Geom.Rectangle(rX, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(g, true);

    g.on("drag", (_pointer: any, dragX: number, dragY: number) => {
      g.setPosition(dragX, dragY);
    });

    g.on("dragend", () => {
      if (this.deliveredLocked) return; // 중복 판정 방지
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect)) {
        this.handleDelivery();
      } else {
        this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 160, ease: "Sine.easeOut" });
      }
    });

    this.hallPieGroup = g;
  }

  private handleDelivery(){
    this.deliveredLocked = true;

    const ok = this.evaluatePie();
    // 피드백: 스프라이트/대사
    const mood = this.getOutcomeSprite(ok ? "success" : "fail");
    this.client.setTexture(this.getClientSprite(mood));
    const text = this.getOutcomeText(ok ? "success" : "fail");
    this.clBox.setVisible(true); this.clText.setVisible(true).setText(text);
    this.myBox.setVisible(false); this.myText.setVisible(false);

    this.afterDeliver(ok);
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C: any = this.stageData.customers?.[0];
    const o: OrderRule = (C?.order || {}) as any;
    const isFinal = this.stageData.id === 7;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const normalize = (s?: string | null) => (s ?? "").replace(/^pie_jam_/, "");

    const fillingOk = isFinal
      ? (normalize(pie.filling) === "magic")
      : (o.filling ? normalize(pie.filling) === normalize(o.filling as any) : true);

    const latticeOk =
      !!(o as any).ignoreLattice ||
      ((o as any).needsLattice === undefined ? true : pie.lattice === !!(o as any).needsLattice) ||
      (isFinal && (o as any).ignoreLattice === true);

    const toppingOk =
      !!(o as any).ignoreToppings ||
      ((o as any).toppings ? (o as any).toppings.every((t: string) => (pie.toppings || []).includes(t)) : true) ||
      (isFinal && (o as any).ignoreToppings === true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    const G = getGameState();
    if (G.pie) (G.pie as any).delivered = true;

    recordEvaluation(ok);
    clearCarriedPie();                // 파이 소모
    this.hallPieGroup?.destroy();     // 화면 제거

    // 성공 시에만 다음 스테이지
    if (ok) advanceStage();

    // 엔딩 분기
    if (this.stageData.id >= 7) {
      const result = computeEnding() as "good" | "normal" | "bad";
      this.time.delayedCall(400, () => this.scene.start("Result", { result }));
    } else {
      // 짧은 대사 확인 시간 후 리셋
      this.time.delayedCall(400, () => this.scene.start("Hall"));
    }
  }
}
