// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, OrderRule } from "../data/loadStage";
import { readCarriedPie, clearCarriedPie, recordEvaluation, advanceStage, computeEnding } from "../data/state";

const POS = {
  background:     { x: 640, y: 360 },
  counter:        { x: 640, y: 360 },
  client:         { x: 480, y: 290 },
  textboxClient:  { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer:  { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen:   { x: 1210, y: 625 },
  board:          { x: 720, y: 620 },
  hallPie:        { x: 740, y: 620 } // 약간 우측
};

const PIE_OFFSET = { x: 0, y: -90 };
const PIE_HIT    = { w: 360, h: 260 };

const DEPTH = {
  BG: -1000,
  CLIENT: 10,
  COUNTER: 12,
  BOARD: 13,
  PIE: 40,
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

  private dialogQueue: any[] = [];
  private awaitingChoice = false;

  private hallBoard!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;

  private deliverRect!: Phaser.Geom.Rectangle;

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
    const P = readCarriedPie();
    const stageId = (await import("../data/state")).getGameState().stageId || 1; // stage id만 필요
    this.stageData = await loadStageData(stageId);

    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard")
      .setOrigin(0.5).setDepth(DEPTH.BOARD).setVisible(true);

    // deliverZone(JSON) 우선, 없으면 스프라이트 기준 + 우측 보정
    const dz: any = (this.stageData as any)?.layout?.hall?.deliverZone;
    if (dz) {
      this.deliverRect = new Phaser.Geom.Rectangle(dz.x - dz.w/2 + 20, dz.y - dz.h/2, dz.w, dz.h);
    } else {
      const cb = this.client.getBounds();
      const cx = cb.x + cb.width * 0.5;
      const cy = cb.y + cb.height * 0.5;
      this.deliverRect = new Phaser.Geom.Rectangle(
        cx - cb.width  * 0.35 + 40,
        cy - cb.height * 0.35,
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

    // 파이를 들고 있으면 주문 대사 스킵, 아니면 항상 대사 시작
    if (P?.cooked) {
      this.dialogQueue = [];
      this.hideBubbles();
    } else {
      const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
      this.dialogQueue = [...pre, { who: "client", text: "" } as any];
      this.showNextFromQueue();
    }

    // 파이 복원
    if (P?.cooked) {
      this.spawnHallPie(P.filling ?? null, !!P.lattice, P.toppings ?? []);
    }
  }

  private getClientSprite(face: string = "standard"): string {
    const C: any = this.stageData.customers?.[0];
    const s = (C?.sprites ?? {}) as Record<string,string>;
    return s[face] || "client_levin_standard";
  }

  // outcome 대사 헬퍼(JSON: successLine/failLine 우선)
  private getOutcomeLine(type: "success"|"fail"): { text: string; sprite: "standard"|"happy"|"angry" } {
    const C: any = this.stageData?.customers?.[0] ?? {};
    if (type==="success" && C.successLine?.text) return { text: String(C.successLine.text), sprite: (C.successLine.sprite ?? "happy") };
    if (type==="fail"    && C.failLine?.text)    return { text: String(C.failLine.text),    sprite: (C.failLine.sprite ?? "angry") };
    return type==="success"
      ? { text: "고마워. 딱 내가 원하던 파이야.", sprite: "happy" }
      : { text: "…이건 주문이 아니야.",         sprite: "angry" };
  }

  private showClientLine(text: string, sprite: "standard"|"happy"|"angry" = "standard", ms=800, onDone?: ()=>void){
    this.client.setTexture(this.getClientSprite(sprite));
    this.clBox.setVisible(true); this.clText.setVisible(true).setText(text);
    if (ms > 0) {
      this.time.delayedCall(ms, () => { this.clBox.setVisible(false); this.clText.setVisible(false); onDone?.(); });
    }
  }

  // ===== 대화 =====
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

  private destroyChoices(){ this.choiceA?.destroy(); this.choiceB?.destroy(); this.choiceA=undefined; this.choiceB=undefined; }
  private hideBubbles(){ this.clBox.setVisible(false); this.clText.setVisible(false); this.myBox.setVisible(false); this.myText.setVisible(false); }
  private advance(){ if (!this.awaitingChoice) this.showNextFromQueue(); }

  // ===== 파이 표시/전달 =====
  private spawnHallPie(filling: string | null, lattice: boolean, toppings: string[]){
    this.hallPieGroup?.destroy();

    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t));

    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(
      new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(g, true);

    g.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      g.setPosition(dragX, dragY);
    });

    g.on("dragend", () => {
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect)) {
        g.setVisible(false); // 평가 중 숨김
        const ok = this.evaluatePie();
        this.afterDeliver(ok);
      } else {
        this.tweens.add({
          targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 180,
          onComplete: () => g.setVisible(true)
        });
      }
    });

    this.hallPieGroup = g;
  }

  private evaluatePie(): boolean {
    const P = readCarriedPie();
    if (!P || !P.cooked) return false;

    const C: any = this.stageData.customers?.[0];
    const o: OrderRule = C?.order || {};
    const isFinal = (this.stageData as any).id === 7;

  // ★ null/undefined 허용 + 접두어 제거
    const normalize = (s: string | null | undefined) =>
      (s ?? "").replace(/^pie_jam_/, "");

    const fillingOk = isFinal
      ? (normalize(P.filling) === "magic")
      : (o.filling ? normalize(P.filling) === normalize((o as any).filling) : true);

    const latticeOk =
      !!(o as any).ignoreLattice ||
      (o.needsLattice === undefined ? true : !!P.lattice === !!o.needsLattice) ||
      (isFinal && (o as any).ignoreLattice === true);

    const toppingOk =
      !!(o as any).ignoreToppings ||
      (o.toppings ? o.toppings.every(t => P.toppings.includes(t)) : true) ||
      (isFinal && (o as any).ignoreToppings === true);

    return !!(P.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean) {
    const P = readCarriedPie();
    if (P) P.delivered = true;

    recordEvaluation(ok);
    clearCarriedPie();
    this.hallPieGroup?.destroy();

    const id = this.stageData.id;
    const C: any = this.stageData.customers?.[0];

  // === 마지막 스테이지 처리 ===
    if (id === 7 || this.stageData.endGame) {
      const lines = ok ? this.stageData.epilogueSuccess : this.stageData.epilogueFail;

      if (Array.isArray(lines) && lines.length > 0) {
      // 대사 순차 출력
        let i = 0;
        const next = () => {
          const L = lines[i++];
          if (!L) {
          const result = computeEnding();
            this.scene.start("Result", { result });
            return;
          }
          const sprite = (typeof L.sprite === "string" && L.sprite.length > 0) ? L.sprite : "standard";

          this.showClientLine(
            L.text ?? "",
            sprite as string,
            1400,
            next
          );
        };
        next();
      } else {
      // 예비 방어: epilogue 없을 경우 즉시 결과 화면
        const result = computeEnding();
        this.scene.start("Result", { result });
      }
      return;
    }

  // === 일반 스테이지 처리 ===
    const outcomeText = ok
      ? (C?.successLine?.text ?? "좋았어! 완벽해!")
      : (C?.failLine?.text ?? "이건 좀 아닌데...");

    const sprite = ok
      ? (C?.successLine?.sprite ?? "happy")
      : (C?.failLine?.sprite ?? "angry");

    this.showClientLine(outcomeText, sprite, 1000, () => {
      advanceStage();
      this.scene.start("Hall");
    });
  }
}