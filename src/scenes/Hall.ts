import Phaser from "phaser";
import { loadStageData, StageData, Line, DialogNode, OrderRule } from "../data/loadStage";
import { getGameState, setGameState, clearCarriedPie, recordEvaluation, advanceStage, computeEnding } from "../data/state";

// 좌표 수동 지정
const POS = {
  background: { x: 640, y: 360 },
  counter: { x: 640, y: 360 },
  client: { x: 480, y: 290 },
  textboxClient: { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer: { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen: { x: 1210, y: 625 },

  // 파이를 올려둘 카운터 위치(홀)
  hallPie:    { x: 720, y: 620 },
  // 전달 존(손님 영역에서 10% 축소)
  deliverZone: { x: 480, y: 360, w: Math.floor(531*0.9), h: Math.floor(540*0.9) }
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

  // 홀에서 들고 있는 파이 표현
  private hallPieGroup?: Phaser.GameObjects.Container;
  private hallPieBottom?: Phaser.GameObjects.Image;
  private hallPieJam?: Phaser.GameObjects.Image;
  private hallPieTop?: Phaser.GameObjects.Image;

  async create(data: any) {
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/클라이언트/카운터
    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(-1000);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(10);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(12);

    // 말풍선
    this.clBox = this.add.image(POS.textboxClient.x, POS.textboxClient.y, "hall_textbox")
      .setDepth(20).setVisible(false).setInteractive({ useHandCursor:true });
    this.myBox = this.add.image(POS.textboxPlayer.x, POS.textboxPlayer.y, "hall_mytextbox")
      .setDepth(21).setVisible(false).setInteractive({ useHandCursor:true });

    this.clText = this.add.text(POS.textboxClient.textX, POS.textboxClient.textY, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#140605", wordWrap:{ width: POS.textboxClient.wrap }
    }).setDepth(31).setVisible(false);

    this.myText = this.add.text(POS.textboxPlayer.textX, POS.textboxPlayer.textY, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", wordWrap:{ width: POS.textboxPlayer.wrap }
    }).setDepth(32).setVisible(false);

    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    // 주방 화살표
    this.toKitchenArrow = this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(40).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 들고 온 파이 있으면 카운터에 표시 + 드래그로 손님에게 전달
    if (G.pie?.cooked) {
      this.spawnHallPie(G.pie.filling ?? null, !!G.pie.lattice, G.pie.toppings ?? []);
    }

    // 프리 대화 → 주문 대화
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who: "client", text: "" } as any];
    this.showNextFromQueue();
  }

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
    const who = next.who === "player" ? "player" : "client";
    if (who === "client") {
      this.myBox.setVisible(false); this.myText.setVisible(false);
      this.clBox.setVisible(true);  this.clText.setVisible(true).setText(next.text);
    } else {
      this.clBox.setVisible(false); this.clText.setVisible(false);
      this.myBox.setVisible(true);  this.myText.setVisible(true).setText(next.text);
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
      }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor:true });
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

  // ====== 홀 파이 표시/전달 ======
  private spawnHallPie(filling: string | null, lattice: boolean, toppings: string[]){
    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(30);
    const bottom = this.add.image(0, 0, "pie_bottom_cooked");
    const jam = this.add.image(0, 0, filling ?? "pie_jam_apple").setVisible(!!filling);
    const top = this.add.image(0, 0, lattice ? "pie_top_cooked" : "pie_top_cooked").setVisible(lattice);
    g.add([bottom, jam, top]);

    for (const t of toppings) g.add(this.add.image(0,0,t).setDepth(31));

    // 드래그로 손님 deliverZone에 넣으면 판정
    g.setSize(220, 220);
    g.setInteractive();
    this.input.setDraggable(g, true);

    const dz = new Phaser.Geom.Rectangle(
      POS.deliverZone.x - POS.deliverZone.w/2,
      POS.deliverZone.y - POS.deliverZone.h/2,
      POS.deliverZone.w, POS.deliverZone.h
    );

    this.input.on("drag", (_p:any, ob:any, nx:number, ny:number)=>{
      if (ob === g) g.setPosition(nx, ny);
    });
    this.input.on("dragend", (_p:any, ob:any)=>{
      if (ob !== g) return;
      const r = g.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, dz)) {
        // 판정
        const ok = this.evaluatePie();
        // 기록/전환
        this.afterDeliver(오케이);
      } else {
        // 스냅백
        this.tweens.add({ targets: g, x: POS.hallPie.x, y: POS.hallPie.y, duration: 160 });
      }
    });

    this.hallPieGroup = g; this.hallPieBottom = bottom; this.hallPieJam = jam; this.hallPieTop = top;
  }

  private evaluatePie(): boolean {
    const G = getGameState();
    const C = this.stageData.customers?.[0];
    const o: OrderRule = C?.order || {};
    const isFinal = this.stageData.id === 7;

    const pie = G.pie;
    if (!pie || !pie.cooked) return false;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic") : (o.filling ? pie.filling === o.filling : true);
    const latticeOk  = o.ignoreLattice  || (o.needsLattice === undefined ? true : pie.lattice === !!o.needsLattice) || (isFinal && o.ignoreLattice === true);
    const toppingOk  = o.ignoreToppings || (o.toppings ? o.toppings.every(t => pie.toppings.includes(t)) : true) || (isFinal && o.ignoreToppings === true);

    return !!(pie.cooked && fillingOk && latticeOk && toppingOk);
  }

  private afterDeliver(ok: boolean){
    recordEvaluation(오케이);
    clearCarriedPie(); // 파이는 소모됨

    // 스테이지 7이면 엔딩으로
    if (this.stageData.id >= 7) {
      const result = computeEnding(); // "good" | "normal" | "bad"
      this.scene.start("Result", { result });
      return;
    }
    // 다음 스테이지로
    advanceStage();
    this.scene.start("Hall");
  }
}
