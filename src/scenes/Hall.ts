// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, OrderRule, Line } from "../data/loadStage";
import { getGameState, readCarriedPie, clearCarriedPie, recordEvaluation, advanceStage, computeEnding } from "../data/state";

const POS = {
  background: { x: 640, y: 360 },
  counter:    { x: 640, y: 360 },
  client:     { x: 480, y: 290 },
  board:      { x: 720, y: 620 },
  hallPie:    { x: 720, y: 620 },
  textboxClient: { x: 960, y: 305, textX: 775, textY: 205 },
  textboxPlayer: { x: 325, y: 550, textX: 125, textY: 483 },
  arrowKitchen:  { x: 1210, y: 625 }
};

const DEPTH = { BG:-1000, CLIENT:10, COUNTER:12, BOARD:13, PIE:40, UI:30, CHOICE:50 };
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
  private hallBoard!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;
  private deliverRect!: Phaser.Geom.Rectangle;

  private dialogQueue: any[] = [];
  private awaitingChoice = false;
  private choiceButtons: Phaser.GameObjects.Text[] = [];

  preload(){
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter",    "assets/images/hall_counter.png");
    this.load.image("hall_arrow",      "assets/images/hall_arrow.png");
    this.load.image("hall_textbox",    "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",  "assets/images/hall_mytextbox.png");

    this.load.image("client_levin_standard","assets/images/client_levin_standard.png");
    this.load.image("client_levin_happy",   "assets/images/client_levin_happy.png");
    this.load.image("client_levin_angry",   "assets/images/client_levin_angry.png");
    this.load.image("client_hide_standard", "assets/images/client_hide_standard.png");
    this.load.image("client_hide_changed",  "assets/images/client_hide_changed.png");
    this.load.image("client_hide_angry",    "assets/images/client_hide_angry.png");

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

    this.add.image(POS.background.x, POS.background.y, "hall_background").setDepth(DEPTH.BG);
    this.client = this.add.image(POS.client.x, POS.client.y, this.getClientSprite("standard")).setDepth(DEPTH.CLIENT);
    this.add.image(POS.counter.x, POS.counter.y, "hall_counter").setDepth(DEPTH.COUNTER);
    this.hallBoard = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard").setDepth(DEPTH.BOARD).setVisible(true);

    const dz = this.stageData.layout?.hall?.deliverZone;
    if (dz) this.deliverRect = new Phaser.Geom.Rectangle(dz.x - dz.w/2, dz.y - dz.h/2, dz.w, dz.h);
    else {
      const cb = this.client.getBounds();
      this.deliverRect = new Phaser.Geom.Rectangle(cb.x+cb.width*0.35, cb.y+cb.height*0.35, cb.width*0.7, cb.height*0.6);
    }
    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());
    // 말풍선
    this.clBox = this.add.image(POS.textboxClient.x, POS.textboxClient.y, "hall_textbox").setDepth(DEPTH.UI).setVisible(false);
    this.myBox = this.add.image(POS.textboxPlayer.x, POS.textboxPlayer.y, "hall_mytextbox").setDepth(DEPTH.UI+1).setVisible(false);
    this.clText = this.add.text(POS.textboxClient.textX, POS.textboxClient.textY, "", { fontFamily:"sans-serif", fontSize:"28px", color:"#140605", wordWrap:{ width:420 } }).setDepth(DEPTH.UI+2).setVisible(false);
    this.myText = this.add.text(POS.textboxPlayer.textX, POS.textboxPlayer.textY, "", { fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", wordWrap:{ width:420 } }).setDepth(DEPTH.UI+3).setVisible(false);

    
    // 주방으로 이동
    this.add.image(POS.arrowKitchen.x, POS.arrowKitchen.y, "hall_arrow")
      .setDepth(DEPTH.UI+5).setInteractive({ useHandCursor:true })
      .on("pointerup", ()=> this.scene.start("Stage"));

    // 파이 복원 여부
    const P = readCarriedPie();
    if (P?.cooked && !P.delivered) {
      this.spawnHallPie(P.filling, P.lattice, P.toppings ?? []);
      this.beginOrderDialogue(); // 이미 주문 진행 중이면 대사 생략
    } else {
      const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
      this.dialogQueue = [...pre, { who:"client", text:"" } as any];
      this.showNextFromQueue();
    }
  }

  private getClientSprite(face: string = "standard"): string {
    const C: any = this.stageData.customers?.[0];
    const map = (C?.sprites ?? {}) as Record<string,string>;
    return map[face] || Object.values(map)[0] || "client_levin_standard";
  }

  private showNextFromQueue(){
    const next:any = this.dialogQueue.shift();
    if (!next) { this.beginOrderDialogue(); return; }
    if (next.sprite) this.client.setTexture(this.getClientSprite(next.sprite));
    if (next.who === "player"){
      this.clBox.setVisible(false); this.myBox.setVisible(true);
      this.myText.setText(next.text).setVisible(true);
    } else {
      this.myBox.setVisible(false); this.clBox.setVisible(true);
      this.clText.setText(next.text).setVisible(true);
    }
  }

  private beginOrderDialogue(){
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    if (!dlg.length){ this.hideBubbles(); return; }
    const first = dlg.find((n:any)=>n.id==="d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id:string){
    const dlg:any[] = this.stageData.customers?.[0]?.dialogue ?? [];
    const node:any = dlg.find(n=>n.id===id);
    if (!node) return;
    this.showClientLine(node.text, node.sprite ?? "standard", 0);
    this.destroyChoices();
    if (node.choices?.length){
      let y = 640;
      for (const ch of node.choices){
        const btn = this.add.text(640, y, ch.label, { fontFamily:"sans-serif", fontSize:"24px", color:"#F7E2B2", backgroundColor:"#6E2B8B" })
          .setOrigin(0.5).setDepth(DEPTH.CHOICE).setInteractive({ useHandCursor:true });
        btn.on("pointerup", ()=>{
          this.destroyChoices();
          if (ch.next !== "end") this.playDialogNode(ch.next);
          else this.hideBubbles();
        });
        this.choiceButtons.push(btn);
        y += 50;
      }
    }
  }

  private destroyChoices(){ this.choiceButtons.forEach(b=>b.destroy()); this.choiceButtons=[]; }
  private hideBubbles(){ this.clBox.setVisible(false); this.clText.setVisible(false); this.myBox.setVisible(false); this.myText.setVisible(false); }

  private spawnHallPie(filling:string|null, lattice:boolean, toppings:string[]){
    this.hallPieGroup?.destroy();
    const g = this.add.container(POS.hallPie.x, POS.hallPie.y).setDepth(DEPTH.PIE);
    const bottom=this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,"pie_bottom_cooked").setVisible(true);
    const jam=this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,filling??"pie_jam_apple").setVisible(!!filling);
    const top=this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,"pie_top_cooked").setVisible(!!lattice);
    g.add([bottom,jam,top]);
    for(const t of toppings) g.add(this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,t));
    g.setSize(PIE_HIT.w,PIE_HIT.h);
    g.setInteractive(new Phaser.Geom.Rectangle(-PIE_HIT.w/2,-PIE_HIT.h/2,PIE_HIT.w,PIE_HIT.h), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(g,true);
    g.on("drag",(_p:any,x:number,y:number)=>g.setPosition(x,y));
    g.on("dragend",()=>{
      const r=g.getBounds();
      if(Phaser.Geom.Intersects.RectangleToRectangle(r,this.deliverRect)){
        const ok=this.evaluatePie(); this.afterDeliver(ok);
      } else {
        this.tweens.add({targets:g,x:POS.hallPie.x,y:POS.hallPie.y,duration:160});
      }
    });
    this.hallPieGroup=g;
  }

  private evaluatePie():boolean{
    const G=getGameState(); const C=this.stageData.customers?.[0]; const o:OrderRule=C?.order||{}; const P=G.pie;
    if(!P||!P.cooked)return false;
    const norm=(s?:string)=>s?.replace("pie_jam_","");
    const fillingOk=o.filling?norm(P.filling)===norm(o.filling):true;
    const latticeOk=o.ignoreLattice||(o.needsLattice===undefined?true:P.lattice===!!o.needsLattice);
    const toppingOk=o.ignoreToppings||(Array.isArray(o.toppings)?o.toppings.every(t=>(P.toppings??[]).includes(t)):true);
    return !!(P.cooked&&fillingOk&&latticeOk&&toppingOk);
  }

  private getOutcomeLine(type:"success"|"fail"):Line{
    const C:any=this.stageData.customers?.[0]??{};
    if(type==="success"&&C.successLine)return C.successLine;
    if(type==="fail"&&C.failLine)return C.failLine;
    return {who:"client",text:type==="success"?"고마워. 완벽해!":"…이건 주문이 아니야.",sprite:type==="success"?"happy":"angry"};
  }

  private showClientLine(text:string,sprite:string="standard",ms=1200,next?:()=>void){
    this.client.setTexture(this.getClientSprite(sprite));
    this.clBox.setVisible(true);this.clText.setVisible(true).setText(text);
    this.time.delayedCall(ms,()=>{this.clBox.setVisible(false);this.clText.setVisible(false);next?.();});
  }

  private playEpilogue(lines:Line[],done:()=>void){
    const run=(i:number)=>{
      if(i>=lines.length){done();return;}
      const L=lines[i];
      this.showClientLine(L.text,L.sprite??"standard",1300,()=>run(i+1));
    };run(0);
  }

  private afterDeliver(ok:boolean){
    const G=getGameState(); if(G.pie)G.pie.delivered=true;
    recordEvaluation(ok); clearCarriedPie(); this.hallPieGroup?.destroy();
    const line=this.getOutcomeLine(ok?"success":"fail");
    const nextStage=()=>{
      if(this.stageData.endGame){
        const epi=ok?(this.stageData.epilogueSuccess??[]):(this.stageData.epilogueFail??[]);
        if(epi.length)this.playEpilogue(epi,()=>this.scene.start("Result",{result:computeEnding()}));
        else this.scene.start("Result",{result:computeEnding()});
      }else{
        if(ok)advanceStage();
        this.scene.start("Hall");
      }
    };
    this.showClientLine(line.text,line.sprite??"standard",1400,nextStage);
  }
}
