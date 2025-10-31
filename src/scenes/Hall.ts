import Phaser from "phaser";
import { loadStageData, StageData, Line, OrderRule } from "@/data/loadStage";
import { getGameState, clearCarriedPie, recordEvaluation, advanceStage, computeEnding } from "@/data/state";

const POS = {
  background: { x: 640, y: 360 },
  counter:    { x: 640, y: 360 },
  client:     { x: 480, y: 290 },          // 스프라이트 표시는 고정, 판정은 JSON deliverZone 사용
  board:      { x: 720, y: 620 },
  hallPie:    { x: 720, y: 620 }
};

const PIE_OFFSET = { x: 0, y: -90 };
const PIE_HIT    = { w: 520, h: 360 };     // 넉넉한 컨테이너 히트박스

const DEPTH = {
  BG: -1000,
  CLIENT: 10,
  COUNTER: 12,
  BOARD: 13,
  PIE: 40,   // 말풍선보다 위
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

  // 납품 판정은 JSON deliverZone (절대좌표)
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
    this.load.image("pie_jam_pumpkin",       "assets/images/pie_jam_pumpkin.png");
    this.load.image("pie_jam_raspberry",     "assets/images/pie_jam_raspberry.png");
    this.load.image("pie_jam_blueberry",     "assets/images/pie_jam_blueberry.png");
    this.load.image("pie_jam_strawberry",    "assets/images/pie_jam_strawberry.png");
    this.load.image("pie_jam_pecan",         "assets/images/pie_jam_pecan.png");
    this.load.image("pie_jam_magic",         "assets/images/pie_jam_magic.png");

    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");
  }

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

    // 전달 판정: JSON deliverZone 사용(절대좌표)
    const dz = (this.stageData as any)?.layout?.hall?.deliverZone;
    if (dz) {
      this.deliverRect = new Phaser.Geom.Rectangle(dz.x - dz.w/2, dz.y - dz.h/2, dz.w, dz.h);
    } else {
      // 폴백(안전)
      const cb = this.client.getBounds();
      this.deliverRect = new Phaser.Geom.Rectangle(cb.centerX - cb.width*0.35, cb.centerY - cb.height*0.35, cb.width*0.7, cb.height*0.6);
    }

    // 말풍선 UI
    this.clBox = this.add.image((this.stageData as any)?.ui?.textboxClient?.x ?? 960, (this.stageData as any)?.ui?.textboxClient?.y ?? 305, "hall_textbox")
      .setDepth(DEPTH.UI).setVisible(false).setInteractive({ useHandCursor:true });
    this.myBox = this.add.image((this.stageData as any)?.ui?.textboxPlayer?.x ?? 325, (this.stageData as any)?.ui?.textboxPlayer?.y ?? 550, "hall_mytextbox")
      .setDepth(DEPTH.UI+1).setVisible(false).setInteractive({ useHandCursor:true });

    this.clText = this.add.text( (this.stageData as any)?.ui?.textboxClient?.textX ?? 775, (this.stageData as any)?.ui?.textboxClient?.textY ?? 205, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#140605", wordWrap:{ width: 420 }, lineSpacing: 6
    }).setDepth(DEPTH.UI+2).setVisible(false);

    this.myText = this.add.text( (this.stageData as any)?.ui?.textboxPlayer?.textX ?? 125, (this.stageData as any)?.ui?.textboxPlayer?.textY ?? 483, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", wordWrap:{ width: 420 }, lineSpacing: 8
    }).setDepth(DEPTH.UI+3).setVisible(false);

    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    // 주방 이동 화살표: JSON ui.arrowToKitchen
    const arrowK = (this.stageData as any)?.ui?.arrowToKitchen ?? { x: 1210, y: 625 };
    this.toKitchenArrow = this.add.image(arrowK.x, arrowK.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 들고 온 파이가 있으면: 주문 대사 차단 + 파이 표시
    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
      this.hideBubbles();
      this.dialogQueue = [];
    } else {
      // 프리 대화 → 주문 대화
      const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
      this.dialogQueue = [...pre, { who: "client", text: "" } as any];
      this.showNextFromQueue();
    }
  }

  private getClientSprite(face: "standard"|"happy"|"angry"="standard"){
    const C: any = this.stageData.customers?.[0];
    const s = C?.sprites || {};
    return s[face] || "client_levin_standard";
  }

  // 성공/실패 대사(JSON) → 없으면 폴백
  private getOutcomeText(type: "success"|"fail"){ 
    const C: any = this.stageData.customers?.[0] ?? {};
    if (type==="success" && C.successLine?.text) return String(C.successLine.text);
    if (type==="fail"    && C.failLine?.text)    return String(C.failLine.text);
    // 다른 키 후보들
    if (type==="success" && C.deliver?.success)  return String(C.deliver.success);
    if (type==="fail"    && C.deliver?.fail)     return String(C.deliver.fail);
    return type==="success" ? "좋아. 딱 원하던 파이야." : "…이건 주문이 아니야.";
  }
  private getOutcomeSprite(type:"success"|"fail"):{
    const C: any = this.stageData.customers?.[0] ?? {};
    const key = type==="success" ? C.successLine?.sprite : C.failLine?.sprite;
    if (key==="happy"||key==="angry"||key==="standard") return key;
    return type==="success" ? "happy" : "angry";
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

  private destroyChoices(){ this.choiceA?.destroy(); this.choiceB?.destroy(); this.choiceA=undefined; this.choiceB=undefined; }
  private hideBubbles(){ this.clBox.setVisible(false); this.clText.setVisible(false); this.myBox.setVisible(false); this.myText.setVisible(false); }
  private advance(){ if (!this.awaitingChoice) this.showNextFromQueue(); }

  private spawnHallPie(filling: string | null, lattice: boolean, toppings: string[]){
    this.hallPieGroup?.destroy();
    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);
    const bottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_cooked").setVisible(true);
    const jam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_cooked").setVisible(!!lattice);
    g.add([bottom, jam, top]);
    for (const t of toppings) g.add(this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t));

    g.setSize(PIE_HIT.w, PIE_HIT.h);
    g.setInteractive(new Phaser.Geom.Rectangle(-PIE_HIT.w/2, -PIE_HIT.h/2, PIE_HIT.w, PIE_HIT.h), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(g, true);

    g.on("drag", (_p: Phaser.Input.Pointer, dx: number, dy: number)=>{ g.setPosition(dx,dy); });

    g.on("dragend", () => {
      // 파이 바운즈가 deliverRect(절대좌표)와 겹치면 납품
      const r = g.getBounds();
      const hit = Phaser.Geom.Intersects.RectangleToRectangle(r, this.deliverRect);
      if (!hit) {
        // 미스: 흔들고 원위치
        this.tweens.add({ targets: g, x: g.x + 8, duration: 60, yoyo: true, repeat: 2 });
        this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 280, ease: "Sine.easeOut", delay: 120 });
        return;
      }

      const ok = this.evaluatePie();
      if (!ok) {
        // 실패 대사(JSON)
        const text = this.getOutcomeText("fail");
        const sprite = this.getOutcomeSprite("fail");
        const flash = this.add.rectangle(g.x, g.y, PIE_HIT.w, PIE_HIT.h, 0xff0000, 0.15).setDepth(DEPTH.PIE + 1);
        this.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
        this.client.setTexture(this.getClientSprite(sprite as any));
        this.clBox.setVisible(true); this.clText.setVisible(true).setText(text);
        this.time.delayedCall(700, ()=>{
          this.clBox.setVisible(false); this.clText.setVisible(false);
          this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 280, ease: "Sine.easeOut" });
        });
        return;
      }

      // 성공: 성공 대사(JSON) → 짧게 보여준 뒤 처리
      const text = this.getOutcomeText("success");
      const sprite = this.getOutcomeSprite("success");
      this.client.setTexture(this.getClientSprite(sprite as any));
      this.clBox.setVisible(true); this.clText.setVisible(true).setText(text);
      this.tweens.add({ targets: g, scale: 1.05, alpha: 0.0, duration: 220, ease: "Sine.easeIn" });
      this.time.delayedCall(320, ()=>{
        this.clBox.setVisible(false); this.clText.setVisible(false);
        this.afterDeliver(true);
      });
    });

    this.hallPieGroup = g;
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C: any = this.stageData.customers?.[0];
    const o: OrderRule = (C?.order || {}) as OrderRule;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const fillingOk = o.filling ? pie.filling === o.filling : true; // 키 그대로 비교
    const latticeOk = o.ignoreLattice || (o.needsLattice === undefined ? true : pie.lattice === !!o.needsLattice);
    const toppingOk = o.ignoreToppings || (o.toppings ? o.toppings.every(t => pie.toppings.includes(t)) : true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    const G = getGameState();
    if (G.pie) G.pie.delivered = true;

    recordEvaluation(ok);
    clearCarriedPie();
    this.hallPieGroup?.destroy();

    if (ok) advanceStage();

    if ((this.stageData as any)?.id >= 7) {
      const result = computeEnding() as "good"|"normal"|"bad";
      this.scene.start("Result", { result });
    } else {
      this.scene.start("Hall");
    }
  }
}
