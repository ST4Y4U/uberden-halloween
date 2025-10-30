import Phaser from "phaser";

type Who = "client" | "player";
type Line = { who: Who; text: string; sprite?: string };
type Choice = { label: string; next: string };
type DialogueNode = { id: string; who: Who; text: string; sprite?: string; choices?: Choice[] };

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

  private COLOR_CLIENT = "#140605";
  private COLOR_PLAYER = "#F7E2B2";

  private stageData: any;
  private customer: any;

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;
  private choiceButtons: Phaser.GameObjects.Container[] = [];

  // 좌표: 네가 준 값 반영
  private POS = {
    clientStand: { x: 491, y: 298, depth: 1 },
    textClient:  { x: 775, y: 205 }, // 손님 말풍선 내 텍스트 중심
    textPlayer:  { x: 125, y: 483 }, // 플레이어 말풍선 내 텍스트 중심
    wrapClient:  460,                // 필요시 조정 전달
    wrapPlayer:  460,
    toKitchen:   { x: 1184, y: 648, depth: 10000 }
  };

  preload(){
    const cur = this.registry.get("currentStage") || 1;
    this.load.json("stageData", `assets/data/stage0${cur}.json`);

    this.load.image("hall_background",  "assets/images/hall_background.webp");
    this.load.image("hall_counter",     "assets/images/hall_counter.png");
    this.load.image("hall_textbox",     "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",   "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow",       "assets/images/hall_arrow.png");

    // 미리보기용 파이
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",   "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked","assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",      "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",   "assets/images/pie_top_cooked.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);
    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    const names = ["levin","cheongbi","liora","lorica","sonya","hide"];
    const states = ["standard","happy","angry","changed"];
    for (const n of names) for (const s of states) {
      this.load.image(`client_${n}_${s}`, `assets/images/client_${n}_${s}.png`);
    }

    this.load.on("loaderror", (file:any) => console.warn("[Hall] loaderror:", file?.key, file?.url));
  }

  create(){
    const data = this.cache.json.get("stageData");
    if (!data){
      this.add.text(640,360,"stage 데이터 로드 실패\n/assets/data/stage0N.json 확인",{
        fontFamily:"sans-serif", fontSize:"24px", color:"#F7E2B2", align:"center", wordWrap:{width:800}
      }).setOrigin(0.5);
      this.time.delayedCall(1500, ()=> this.scene.start("MainMenu"));
      return;
    }
    this.stageData = data;
    const H = this.stageData.layout?.hall ?? {};
    const UI = this.stageData.ui ?? {};
    this.customer = this.stageData.customers?.[0];

    // 배경/카운터
    this.add.image(640, 360, "hall_background").setDepth(-1000);
    this.add.image(640, 360, "hall_counter").setDepth(10);

    // 손님
    const clientTex = this.customer?.sprites?.standard || "client_levin_standard";
    this.client = this.add.image(H.standX ?? this.POS.clientStand.x, H.standY ?? this.POS.clientStand.y, clientTex).setDepth(this.POS.clientStand.depth);

    // 도마 + 미리보기
    this.add.image(820, 420, "pie_cuttingboard").setDepth(12);
    const preview = this.add.container(820, 420).setDepth(13).setVisible(false);
    const pvBottom = this.add.image(0, -90, "pie_bottom_raw").setVisible(false);
    const pvJam    = this.add.image(0, -90, "pie_jam_apple").setVisible(false);
    const pvTop    = this.add.image(0, -90, "pie_top_raw").setVisible(false);
    preview.add([pvBottom, pvJam, pvTop]);
    this.renderPiePreview(preview, pvBottom, pvJam, pvTop);

    // 텍스트박스
    this.textbox = this.add.image(960, 305, "hall_textbox").setDepth(20).setVisible(false).setInteractive({ useHandCursor: true });
    this.myTextbox = this.add.image(325, 550, "hall_mytextbox").setDepth(22).setVisible(false).setInteractive({ useHandCursor: true });

    // 주방 이동 화살표(주문 대화 중엔 선택지 우선)
    const toK = UI.arrowToKitchen ?? this.POS.toKitchen;
    this.toKitchenArrow = this.add.image(toK.x, toK.y, "hall_arrow")
      .setDepth(toK.depth ?? this.POS.toKitchen.depth)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        if (this.choiceButtons.length > 0) return;
        this.scene.start("Stage");
      });

    // 주방에서 방금 돌아왔으면 → 판정
    if (this.registry.get("cameFromKitchen") === true) {
      this.registry.set("cameFromKitchen", false);
      this.runJudgeFlow();
      return;
    }

    // 프리 대화 → 주문 대화
    const pre: Line[] = this.customer?.preDialogue ?? [];
    const dlg: DialogueNode[] = this.customer?.dialogue ?? [];
    if (pre.length > 0) {
      this.runLinearDialogue(pre, () => { if (dlg.length > 0) this.runDialogueWithChoices(dlg); });
    } else if (dlg.length > 0) {
      this.runDialogueWithChoices(dlg);
    }
  }

  // 선형(클릭 진행)
  private runLinearDialogue(lines: Line[], onDone?: () => void){
    let i = 0;
    const next = () => {
      if (i >= lines.length){ this.hideBoxes(); onDone?.(); return; }
      const { who, text, sprite } = lines[i++];
      const isClient = (who === "client");
      if (isClient && sprite && this.customer?.sprites?.[sprite]) this.client.setTexture(this.customer.sprites[sprite]);
      this.showLine(isClient, text);
      this.textbox.removeAllListeners("pointerup");
      this.myTextbox.removeAllListeners("pointerup");
      this.textbox.on("pointerup", next);
      this.myTextbox.on("pointerup", next);
    };
    next();
  }

  // 스무고개(선택지)
  private runDialogueWithChoices(dlg: DialogueNode[], onDone?: () => void){
    const map = new Map<string, DialogueNode>();
    dlg.forEach(n => map.set(n.id, n));
    let curId = dlg[0].id;

    const showNode = (node: DialogueNode) => {
      const isClient = (node.who === "client");
      if (isClient && node.sprite && this.customer?.sprites?.[node.sprite]) this.client.setTexture(this.customer.sprites[node.sprite]);
      this.showLine(isClient, node.text);

      this.clearChoices();
      const choices = node.choices ?? [{ label:"네", next:"end" }];
      this.renderChoices(choices, (nextId) => {
        if (nextId === "end"){ this.hideBoxes(); this.clearChoices(); onDone?.(); return; }
        const nx = map.get(nextId);
        if (!nx){ this.hideBoxes(); this.clearChoices(); onDone?.(); return; }
        curId = nx.id; showNode(nx);
      });
    };

    showNode(map.get(curId)!);
  }

  private renderChoices(choices: Choice[], onPick:(nextId:string)=>void){
    const baseY = 305 + 80; // 손님 텍스트박스 기준
    const gap = 220;
    this.choiceButtons = [];

    choices.forEach((c, i) => {
      const x = 960 + (i - (choices.length - 1)/2) * gap;
      const container = this.add.container(x, baseY).setDepth(26);
      const bg = this.add.rectangle(0, 0, 180, 48, 0x2b1a3a, 0.9).setStrokeStyle(2, 0x6E2B8B).setInteractive({ useHandCursor: true });
      const label = this.add.text(0, 0, c.label, { fontFamily:"sans-serif", fontSize:"22px", color:"#F7E2B2" }).setOrigin(0.5);
      container.add([bg, label]);
      bg.on("pointerup", () => onPick(c.next));
      this.choiceButtons.push(container);
    });
  }

  private clearChoices(){ this.choiceButtons.forEach(c=>c.destroy()); this.choiceButtons = []; }

  private showLine(isClient:boolean, text:string){
    const color = isClient ? this.COLOR_CLIENT : this.COLOR_PLAYER;
    this.textbox.setVisible(isClient);
    this.myTextbox.setVisible(!isClient);
    this.children.getByName("dialogText")?.destroy();

    const pos = isClient ? { x:this.POS.textClient.x, y:this.POS.textClient.y, w:this.POS.wrapClient }
                         : { x:this.POS.textPlayer.x, y:this.POS.textPlayer.y, w:this.POS.wrapPlayer };

    this.add.text(pos.x, pos.y, text, {
      fontFamily:"sans-serif",
      fontSize:"32px",
      color,
      wordWrap: { width: pos.w, useAdvancedWrap:true },
      align:"center"
    }).setOrigin(0.5).setDepth(25).setName("dialogText");
  }

  private hideBoxes(){
    this.textbox.setVisible(false);
    this.myTextbox.setVisible(false);
    this.children.getByName("dialogText")?.destroy();
  }

  // 판정 → 통계 누적 → 다음/엔딩
  private runJudgeFlow(){
    const C = this.customer;
    const stage = this.stageData;
    const pie = this.registry.get("pieState");

    if (!pie || !pie.cooked){
      const lines: Line[] = [C?.failLine ?? { who:"client", text:"…아직 준비가 안 된 모양이군." }];
      if (stage.epilogueFail) lines.push(...stage.epilogueFail);
      this.playLinesThenResult(lines, false);
      return;
    }

    const o = C.order || {};
    const isFinal = stage?.id === 7;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic") : (pie.filling === o.filling);
    const latticeOk  = o.ignoreLattice  || pie.lattice === o.needsLattice || (isFinal && o.ignoreLattice === true);
    const toppingOk  = o.ignoreToppings || (o.toppings ? o.toppings.every((t:string)=> pie.toppings.includes(t)) : true) || (isFinal && o.ignoreToppings === true);

    const ok = pie.cooked && fillingOk && latticeOk && toppingOk;

    if (오케이){
      const lines: Line[] = [C?.successLine ?? { who:"client", text:"좋아." }];
      if (stage.epilogueSuccess) lines.push(...stage.epilogueSuccess);
      this.playLinesThenResult(lines, true);
    } else {
      const lines: Line[] = [C?.failLine ?? { who:"client", text:"유감이군." }];
      if (stage.epilogueFail) lines.push(...stage.epilogueFail);
      this.playLinesThenResult(lines, false);
    }
  }

  private playLinesThenResult(lines: Line[], isSuccess: boolean){
    let i = 0;
    const next = () => {
      if (i >= lines.length){
        this.hideBoxes();

        // ✅ 통계 누적 (정확히 여기)
        const summary = this.registry.get("scoreSummary") || { total:0, good:0, bad:0 };
        summary.total += 1;
        if (isSuccess) summary.good += 1; else summary.bad += 1;
        this.registry.set("scoreSummary", summary);

        const isLast = (this.stageData?.id === 7);
        if (isLast){
          this.scene.start("Result");
        } else {
          const nextStage = (this.stageData?.id || 1) + 1;
          this.registry.set("currentStage", nextStage);
          this.registry.set("pieState", null);
          this.scene.start("Hall");
        }
        return;
      }

      const { who, text, sprite } = lines[i++];
      const isClient = (who === "client");
      if (isClient && sprite && this.customer?.sprites?.[sprite]) this.client.setTexture(this.customer.sprites[sprite]);
      this.showLine(isClient, text);
      this.textbox.removeAllListeners("pointerup");
      this.myTextbox.removeAllListeners("pointerup");
      this.textbox.on("pointerup", next);
      this.myTextbox.on("pointerup", next);
    };
    next();
  }

  private renderPiePreview(preview: Phaser.GameObjects.Container, pvBottom: Phaser.GameObjects.Image, pvJam: Phaser.GameObjects.Image, pvTop: Phaser.GameObjects.Image){
    const state:any = this.registry.get("pieState");
    if (state && state.hasDough){
      preview.setVisible(true);
      pvBottom.setTexture(state.cooked ? "pie_bottom_cooked" : "pie_bottom_raw").setVisible(true);
      if (state.filling) pvJam.setTexture(state.filling).setVisible(true); else pvJam.setVisible(false);
      if (state.lattice) pvTop.setTexture(state.cooked ? "pie_top_cooked" : "pie_top_raw").setVisible(true); else pvTop.setVisible(false);
    } else {
      preview.setVisible(false); pvBottom.setVisible(false); pvJam.setVisible(false); pvTop.setVisible(false);
    }
  }
}
