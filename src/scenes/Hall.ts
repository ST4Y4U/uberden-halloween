// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, OrderRule, Line } from "../data/loadStage";
import {
  getGameState,
  readCarriedPie,
  clearCarriedPie,
  recordEvaluation,
  advanceStage,
  computeEnding,
} from "../data/state";

const POS = {
  background:     { x: 640, y: 360 },
  counter:        { x: 640, y: 360 },
  client:         { x: 480, y: 290 },
  board:          { x: 720, y: 620 },
  hallPie:        { x: 720, y: 620 },
  textboxClient:  { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer:  { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen:   { x: 1210, y: 625 },
};

const DEPTH = { BG: -1000, CLIENT: 10, COUNTER: 12, BOARD: 13, PIE: 40, UI: 30, CHOICE: 50 };
const PIE_HIT = { w: 360, h: 240 };
const PIE_OFFSET = { x: 0, y: -90 };

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

  private stageData!: StageData;

  private client!: Phaser.GameObjects.Image;

  private clBox!: Phaser.GameObjects.Image;
  private clText!: Phaser.GameObjects.Text;
  private myBox!: Phaser.GameObjects.Image;
  private myText!: Phaser.GameObjects.Text;

  private choiceA?: Phaser.GameObjects.Text;
  private choiceB?: Phaser.GameObjects.Text;

  private hallBoard!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;

  private deliverRect!: Phaser.Geom.Rectangle;

  private dialogQueue: any[] = [];
  private awaitingChoice = false;

  preload(){
    // 배경/카운터/화살표
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter",    "assets/images/hall_counter.png");
    this.load.image("hall_arrow",      "assets/images/hall_arrow.png");

    // 말풍선
    this.load.image("hall_textbox",    "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",  "assets/images/hall_mytextbox.png");

    // 손님 스프라이트(스테이지 JSON 매핑)
    this.load.image("client_levin_standard","assets/images/client_levin_standard.png");
    this.load.image("client_levin_happy",   "assets/images/client_levin_happy.png");
    this.load.image("client_levin_angry",   "assets/images/client_levin_angry.png");
    this.load.image("client_hide_standard", "assets/images/client_hide_standard.png");
    this.load.image("client_hide_changed",  "assets/images/client_hide_changed.png");
    this.load.image("client_hide_angry",    "assets/images/client_hide_angry.png");
    this.load.image("client_hide_anxious",    "assets/images/client_hide_anxious.png");
    this.load.image("client_hide_changed",    "assets/images/client_hide_changed.png");

    // 파이
    this.load.image("pie_cuttingboard",  "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_cooked",    "assets/images/pie_top_cooked.png");
    this.load.image("pie_jam_apple",     "assets/images/pie_jam_apple.png");
    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");
  }

  async create(){
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/손님/카운터
    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);

    // 도마는 항상 표시
    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard")
      .setDepth(DEPTH.BOARD).setVisible(true);

    // 배달 영역: JSON 우선, 없으면 손님 스프라이트 기준 추정(오른쪽으로 약간 편향)
    const dz = (this.stageData as any).layout?.hall?.deliverZone;
    if (dz) {
      this.deliverRect = new Phaser.Geom.Rectangle(dz.x - dz.w/2, dz.y - dz.h/2, dz.w, dz.h);
    } else {
      const cb = this.client.getBounds();
      const rightBias = 40;
      this.deliverRect = new Phaser.Geom.Rectangle(
        cb.x + cb.width*0.15 + rightBias,
        cb.y + cb.height*0.2,
        cb.width*0.7,
        cb.height*0.6
      );
    }

    // 말풍선 UI
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

    // 말풍선 터치 → 다음 진행
    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    // 주방으로 이동
    this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 파이 복원 & 대사 큐 초기화
    const P = readCarriedPie();
    if (P?.cooked && !P.delivered) {
  // 파이 들고 오면 주문 대사 스킵
      this.spawnHallPie(P.filling, P.lattice, P.toppings ?? []);
      this.dialogQueue = []; // 대사 시작 안함
    } else {
  // 프리 대사 → 주문
      const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
      this.dialogQueue = [...pre, { who: "client", text: "" } as any];
      this.showNextFromQueue();
    }
  }

  // ===== 대사 진행 =====
  private getClientSprite(face: string = "standard"): string {
    const C: any = this.stageData.customers?.[0];
    const map = (C?.sprites ?? {}) as Record<string,string>;
    return map[face] || Object.values(map)[0] || "client_levin_standard";
  }

// 주체(who)에 따라 올바른 말풍선에 노출
  private showLine(line: Line, ms = 1100, done?: ()=>void){
    const who = line.who || "client";
    if (who === "client") {
      if (line.sprite) this.client.setTexture(this.getClientSprite(line.sprite));
      this.myBox.setVisible(false); this.myText.setVisible(false);
      this.clBox.setVisible(true);  this.clText.setVisible(true).setText(line.text || "");
    } else {
    // player
      this.clBox.setVisible(false); this.clText.setVisible(false);
      this.myBox.setVisible(true);  this.myText.setVisible(true).setText(line.text || "");
    }
    if (ms > 0) {
      this.time.delayedCall(ms, ()=>{
        this.clBox.setVisible(false); this.clText.setVisible(false);
        this.myBox.setVisible(false); this.myText.setVisible(false);
        done?.();
      });
    }
  }

// 에필로그 시퀀스
  private playEpilogue(lines: Line[], next: ()=>void){
    const run = (i:number)=>{
      if (i >= lines.length) { next(); return; }
      const L = lines[i];
      this.showLine(L, 1200, ()=> run(i+1));
    };
    run(0);
  }
  
  private destroyChoices(){ this.choiceA?.destroy(); this.choiceB?.destroy(); this.choiceA=undefined; this.choiceB=undefined; }
  private hideBubbles(){ this.clBox.setVisible(false); this.clText.setVisible(false); this.myBox.setVisible(false); this.myText.setVisible(false); }

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

    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));
    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);

    // 선택지(있으면 표시)
    this.destroyChoices();
    const cs: any[] = node.choices || [];
    if (!cs.length) return;

    this.awaitingChoice = true;
    const makeChoice = (label: string, nextId: string, offset: number)=>{
      const t = this.add.text(640 + offset, 640, label, {
        fontFamily:"sans-serif", fontSize:"28px",
        color:"#F7E2B2", backgroundColor:"#6E2B8B"
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

  private advance(){ if (!this.awaitingChoice) this.showNextFromQueue(); }

  // ===== 파이 표시/드롭 =====
  private spawnHallPie(filling: string|null, lattice: boolean, toppings: string[]){
    this.hallPieGroup?.destroy();

    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);

    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    // NOTE: Stage에서 저장한 값은 "pie_jam_apple" 같은 풀 키이므로 그대로 사용
    const jamKey = filling ?? "pie_jam_apple";
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, jamKey).setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t));

    // 드래그 가능
    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(
      new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(g, true);

    g.on("drag", (_p:any, x:number, y:number)=> g.setPosition(x, y));

    g.on("dragend", ()=>{
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
    const C = this.stageData.customers?.[0];
    const o: OrderRule = C?.order || {};
    const P = G.pie;
    if (!P || !P.cooked) return false;

    const norm = (s?: string) => (s ? s.replace("pie_jam_","") : "");
    const fillingOk = o.filling ? norm(P.filling ?? "") === norm(o.filling ?? "") : true;
    const latticeOk = o.ignoreLattice || (o.needsLattice === undefined ? true : P.lattice === !!o.needsLattice);
    const toppingOk = o.ignoreToppings || (Array.isArray(o.toppings) ? o.toppings.every(tt => (P.toppings ?? []).includes(tt)) : true);

    return !!(P.cooked && fillingOk && latticeOk && toppingOk);
  }

  // 결과 대사 로딩(우선순위: successLine/failLine → 기본)
  private getOutcomeLine(type: "success"|"fail"): Line {
    const C: any = this.stageData.customers?.[0] ?? {};
    if (type==="success" && C.successLine) return C.successLine as Line;
    if (type==="fail"    && C.failLine)    return C.failLine as Line;
    return {
      who: "client",
      text: type==="success" ? "고마워. 딱 내가 원하던 파이야." : "…이건 주문이 아니야.",
      sprite: type==="success" ? "happy" : "angry",
    } as Line;
  }

  private showClientLine(text:string, sprite:string="standard", ms=1100, done?:()=>void){
    this.client.setTexture(this.getClientSprite(sprite));
    this.clBox.setVisible(true); this.clText.setVisible(true).setText(text);
    this.myBox.setVisible(false); this.myText.setVisible(false);
    this.time.delayedCall(ms, ()=>{ this.clBox.setVisible(false); this.clText.setVisible(false); done?.(); });
  }

  private playEpilogue(lines: Line[], next: ()=>void){
    const run = (i:number)=>{
      if (i >= lines.length) { next(); return; }
      const L = lines[i];
      this.showClientLine(L.text, L.sprite ?? "standard", 1200, ()=> run(i+1));
    };
    run(0);
  }

  private afterDeliver(ok: boolean){
  // 통계 기록
    recordEvaluation(ok);

  // 파이 소모/정리
    const P = readCarriedPie();
    if (P) { P.delivered = true; writeCarriedPie(P); }
    clearCarriedPie();
    this.hallPieGroup?.destroy();

  // 결과 대사 선택(라인이 없으면 기본)
    const C: any = this.stageData.customers?.[0] ?? {};
    const line: Line = ok ? (C.successLine as Line) ?? { who:"client", text:"고마워. 딱 내가 원하던 파이야.", sprite:"happy" }
                          : (C.failLine as Line)    ?? { who:"client", text:"…이건 주문이 아니야.",       sprite:"angry" };

    const proceed = () => {
      const isEnd = (this.stageData as any).endGame === true || this.stageData.id >= 7;
      if (isEnd) {
        const ep = ok ? (this.stageData.epilogueSuccess ?? []) : (this.stageData.epilogueFail ?? []);
        if (ep.length) {
          this.playEpilogue(ep, ()=>{
            const result = computeEnding();
            this.scene.start("Result", { result });
          });
        } else {
          const result = computeEnding();
          this.scene.start("Result", { result });
        }
      } else {
      // ✅ 성공/실패 무조건 다음 스테이지로
        advanceStage();
        this.scene.start("Hall");
      }
    };

  // 주체(who)에 맞춰 출력
    this.showLine(line, 1100, proceed);
  }
}
