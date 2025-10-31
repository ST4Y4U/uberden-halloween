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
const PIE_HIT    = { w: 320, h: 220 };

const DEPTH = {
  BG: -1000,
  CLIENT: 10,
  COUNTER: 12,
  BOARD: 13,
  PIE: 14,
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

  // 대화 데이터의 구조가 느슨하므로 any로 둬서 TS 추론 충돌 회피
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
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard")
      .setOrigin(0.5).setDepth(DEPTH.BOARD).setVisible(true);

    // Rectangle.centerX/centerY 타입 경고 회피: 수동 계산
    {
      const cb = this.client.getBounds();
      const cx = cb.x + cb.width * 0.5;
      const cy = cb.y + cb.height * 0.5;
      this.deliverRect = new Phaser.Geom.Rectangle(
        cx - cb.width  * 0.45,
        cy - cb.height * 0.45,
        cb.width  * 0.90,
        cb.height * 0.90
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

    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
    }

    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who: "client", text: "" } as any];
    this.showNextFromQueue();
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

  private spawnHallPie(filling: string | null, lattice: boolean, toppings: string[]){
    this.hallPieGroup?.destroy();

    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) {
      // 컨테이너 자식 depth는 컨테이너 기준이라 굳이 올릴 필요 없음. 그래도 문법상 문제는 없음.
      g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t));
    }

    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(
      new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(g, true);

    g.on("drag", (_pointer: any, dragX: number, dragY: number) => {
      g.setPosition(dragX, dragY);
    });

    g.on("dragend", () => {
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect)) {
        const ok = this.evaluatePie();
        this.afterDeliver(ok);
      } else {
        this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 160 });
      }
    });

    this.hallPieGroup = g;
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C: any = this.stageData.customers?.[0];
    const o: OrderRule & Partial<Record<string, any>> = (C?.order || {}) as any;
    const isFinal = this.stageData.id === 7;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const fillingOk = isFinal
      ? (pie.filling === "pie_jam_magic")
      : (o.filling ? pie.filling === o.filling : true);

    const latticeOk =
      !!o.ignoreLattice ||
      (o.needsLattice === undefined ? true : pie.lattice === !!o.needsLattice) ||
      (isFinal && o.ignoreLattice === true);

    const toppingOk =
      !!o.ignoreToppings ||
      (o.toppings ? o.toppings.every((t: string) => pie.toppings.includes(t)) : true) ||
      (isFinal && o.ignoreToppings === true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    recordEvaluation(ok);
    clearCarriedPie();
    this.hallPieGroup?.destroy();

    if (this.stageData.id >= 7) {
      const result = computeEnding() as "good" | "normal" | "bad";
      this.scene.start("Result", { result });
      return;
    }
    advanceStage();
    this.scene.start("Hall");
  }


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

  // 도마/파이
  private hallBoard!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;

  // 배달 영역(손님 스프라이트 기준 90% 축소)
  private deliverRect!: Phaser.Geom.Rectangle;

  async create() {
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/손님/카운터
    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    // 도마는 상시 표시
    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard")
      .setOrigin(0.5).setDepth(DEPTH.BOARD).setVisible(true);

    // 배달 영역(손님 실측 90%)
    {
      const cb = this.client.getBounds();
      this.deliverRect = new Phaser.Geom.Rectangle(
        cb.centerX - cb.width  * 0.45,
        cb.centerY - cb.height * 0.45,
        cb.width  * 0.90,
        cb.height * 0.90
      );
    }

    // 말풍선
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

    // 주방으로 이동 화살표
    this.toKitchenArrow = this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 들고 온 파이 복원(저장되어 있다면)
    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
    }

    // 프리 대화 → 주문 대화
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who: "client", text: "" } as any];
    this.showNextFromQueue();
  }

  // ===== 대화 처리 =====
  private getClientSprite(face:"standard"|"happy"|"angry"="standard"){
    const C = this.stageData.customers?.[0];
    const s = C?.sprites || {};
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
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    if (!dlg.length){ this.hideBubbles(); return; }
    const first = dlg.find(n=>n.id==="d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id:string){
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    const node = dlg.find(n=>n.id===id);
    if (!node){ this.hideBubbles(); return; }

    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);
    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));

    this.destroyChoices();
    const cs = node.choices || [];
    if (!cs.length) return;
    this.awaitingChoice = true;

    const makeChoice = (label:string, nextId:string, offset:number)=>{
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
    // 기존 파이 있으면 제거(중복 방지)
    this.hallPieGroup?.destroy();

    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) {
      g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t).setDepth(DEPTH.PIE+1));
    }

    // 드래그(오브젝트 단위 핸들러)
    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(g, true);

    g.on("drag", (_pointer: any, dragX: number, dragY: number) => {
      g.setPosition(dragX, dragY);
    });

    g.on("dragend", () => {
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect)) {
        const ok = this.evaluatePie();   // 판정
        this.afterDeliver(ok);           // 기록/진행
      } else {
        this.tweens.add({
          targets: g,
          x: POS.hallPie.x,
          y: POS.hallPie.y,
          duration: 160
        });
      }
    });
    
    this.hallPieGroup = g;
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C = this.stageData.customers?.[0];
    const o: OrderRule = C?.order || {};
    const isFinal = this.stageData.id === 7;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic")
                              : (o.filling ? pie.filling === o.filling : true);

    const latticeOk  = o.ignoreLattice
                    || (o.needsLattice === undefined ? true : pie.lattice === !!o.needsLattice)
                    || (isFinal && o.ignoreLattice === true);

    const toppingOk  = o.ignoreToppings
                    || (o.toppings ? o.toppings.every(t => pie.toppings.includes(t)) : true)
                    || (isFinal && o.ignoreToppings === true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    recordEvaluation(ok);
    clearCarriedPie();                // 파이 소모
    this.hallPieGroup?.destroy();     // 화면에서도 제거

    if (this.stageData.id >= 7) {
      const result = computeEnding(); // "good" | "normal" | "bad"
      this.scene.start("Result", { result });
      return;
    }
    advanceStage();
    this.scene.start("Hall");
  }  
  private clBox!: Phaser.GameObjects.Image;
  private myBox!: Phaser.GameObjects.Image;
  private clText!: Phaser.GameObjects.Text;
  private myText!: Phaser.GameObjects.Text;
  private choiceA?: Phaser.GameObjects.Text;
  private choiceB?: Phaser.GameObjects.Text;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  private dialogQueue: Line[] = [];
  private awaitingChoice = false;

  // 홀 파이 컨테이너
  private hallPieGroup?: Phaser.GameObjects.Container;

  // 배달 영역(손님 스프라이트 기준 90% 축소)
  private deliverRect!: Phaser.Geom.Rectangle;

  async create() {
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/손님/카운터
    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    // 배달 영역 계산(손님 스프라이트 실측)
    {
      const cb = this.client.getBounds();
      this.deliverRect = new Phaser.Geom.Rectangle(
        cb.centerX - cb.width  * 0.45,
        cb.centerY - cb.height * 0.45,
        cb.width  * 0.90,
        cb.height * 0.90
      );
    }

    // 말풍선
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

    // 주방으로 이동 화살표
    this.toKitchenArrow = this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 들고 온 파이 복원
    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
    }

    // 프리 대화 → 주문 대화
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who: "client", text: "" } as any]; // 빈 줄 만나면 주문으로 전환
    this.showNextFromQueue();
  }

  // ===== 대화 처리 =====
  private getClientSprite(face:"standard"|"happy"|"angry"="standard"){
    const C = this.stageData.customers?.[0];
    const s = C?.sprites || {};
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
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    if (!dlg.length){ this.hideBubbles(); return; }
    const first = dlg.find(n=>n.id==="d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id:string){
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    const node = dlg.find(n=>n.id===id);
    if (!node){ this.hideBubbles(); return; }

    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);
    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));

    this.destroyChoices();
    const cs = node.choices || [];
    if (!cs.length) return;
    this.awaitingChoice = true;

    const makeChoice = (label:string, nextId:string, offset:number)=>{
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
    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) {
      g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t).setDepth(DEPTH.PIE+1));
    }

    // 드래그(오브젝트 단위 바인딩)
    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(g, true);

    g.on("drag", (_pointer: any, dragX: number, dragY: number) => {
      g.setPosition(dragX, dragY);
    });

    g.on("dragend", () => {
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect)) {
        const ok = this.evaluatePie();   // 판정
        this.afterDeliver(ok);           // 기록/진행
      } else {
        this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 160 });
      }
    });

    this.hallPieGroup = g;
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C = this.stageData.customers?.[0];
    const o: OrderRule = C?.order || {};
    const isFinal = this.stageData.id === 7;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic")
                              : (o.filling ? pie.filling === o.filling : true);

    const latticeOk  = o.ignoreLattice
                    || (o.needsLattice === undefined ? true : pie.lattice === !!o.needsLattice)
                    || (isFinal && o.ignoreLattice === true);

    const toppingOk  = o.ignoreToppings
                    || (o.toppings ? o.toppings.every(t => pie.toppings.includes(t)) : true)
                    || (isFinal && o.ignoreToppings === true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    recordEvaluation(ok);
    clearCarriedPie(); // 파이 소모

    if (this.stageData.id >= 7) {
      const result = computeEnding(); // "good" | "normal" | "bad"
      this.scene.start("Result", { result });
      return;
    }

    advanceStage();
    this.scene.start("Hall");
  }
}
