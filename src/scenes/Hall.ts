import Phaser from "phaser";

type Who = "client" | "player";
type Line = { who: Who; text: string; sprite?: string };
type Choice = { label: string; next: string }; // id or "end"
type DialogueNode = { id: string; who: Who; text: string; sprite?: string; choices?: Choice[] };

export default class Hall extends Phaser.Scene {
  constructor() { super("Hall"); }

  private POS = {
    background: { x: 640, y: 360, depth: -1000 },
    counter:    { x: 640, y: 360, depth: 10 },
    client:     { x: 491, y: 298, depth: 1 },
    board:      { x: 820, y: 420, depth: 12 },
    pie:        { x: 820, y: 420, depth: 13 },
    textbox:    { x: 960, y: 305, depth: 20 },
    myTextbox:  { x: 325, y: 550, depth: 22 },
    toKitchen:  { x: 1184, y: 648, depth: 10000 }
  } as const;

  private COLOR_CLIENT = "#140605";
  private COLOR_PLAYER = "#F7E2B2";

  private stageData: any;
  private customer: any;

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  private choiceButtons: Phaser.GameObjects.Container[] = [];

  preload() {
    const cur = this.registry.get("currentStage") || 1;
    this.load.json("stageData", `assets/data/stage0${cur}.json`);

    this.load.image("hall_background",  "assets/images/hall_background.webp");
    this.load.image("hall_counter",     "assets/images/hall_counter.png");
    this.load.image("hall_textbox",     "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",   "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow",       "assets/images/hall_arrow.png");

    // 미리보기용
    this.load.image("pie_cuttingboard",   "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",     "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked",  "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",        "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",     "assets/images/pie_top_cooked.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);
    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    // 손님 스프라이트 세트
    const names = ["levin","cheongbi","liora","lorica","sonya","hide"];
    const states = ["standard","happy","angry","changed"];
    for (const n of names) for (const s of states) {
      this.load.image(`client_${n}_${s}`, `assets/images/client_${n}_${s}.png`);
    }
  }

  create() {
    this.stageData = this.cache.json.get("stageData");
    const H = this.stageData.layout?.hall ?? {};
    const UI = this.stageData.ui ?? {};
    this.customer = this.stageData.customers?.[0];

    // 배경/카운터
    this.add.image(this.POS.background.x, this.POS.background.y, "hall_background").setDepth(this.POS.background.depth);
    this.add.image(this.POS.counter.x,    this.POS.counter.y,    "hall_counter").setDepth(this.POS.counter.depth);

    // 손님
    const clientTex = this.customer?.sprites?.standard || "client_levin_standard";
    this.client = this.add.image(H.standX ?? this.POS.client.x, H.standY ?? this.POS.client.y, clientTex).setDepth(this.POS.client.depth);

    // 도마 + 미리보기
    this.add.image(this.POS.board.x, this.POS.board.y, "pie_cuttingboard").setDepth(this.POS.board.depth);
    const preview = this.add.container(this.POS.pie.x, this.POS.pie.y).setDepth(this.POS.pie.depth).setVisible(false);
    const pvBottom = this.add.image(0, -90, "pie_bottom_raw").setVisible(false);
    const pvJam    = this.add.image(0, -90, "pie_jam_apple").setVisible(false);
    const pvTop    = this.add.image(0, -90, "pie_top_raw").setVisible(false);
    preview.add([pvBottom, pvJam, pvTop]);
    this.renderPiePreview(preview, pvBottom, pvJam, pvTop);

    // 텍스트박스
    this.textbox = this.add.image(this.POS.textbox.x, this.POS.textbox.y, "hall_textbox")
      .setDepth(this.POS.textbox.depth).setVisible(false).setInteractive({ useHandCursor: true });
    this.myTextbox = this.add.image(this.POS.myTextbox.x, this.POS.myTextbox.y, "hall_mytextbox")
      .setDepth(this.POS.myTextbox.depth).setVisible(false).setInteractive({ useHandCursor: true });

    // 홀→주방 화살표
    const toK = UI.arrowToKitchen ?? this.POS.toKitchen;
    this.toKitchenArrow = this.add.image(toK.x, toK.y, "hall_arrow")
      .setDepth(toK.depth ?? this.POS.toKitchen.depth)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        if (this.choiceButtons.length > 0) return; // 주문대화 중엔 무시
        this.scene.start("Stage");
      });

    // 주방에서 방금 돌아왔다면 → 판정
    if (this.registry.get("cameFromKitchen") === true) {
      this.registry.set("cameFromKitchen", false);
      this.runJudgeFlow();
      return;
    }

    // 프리대화 → 주문대화(선택지)
    const pre: Line[] = this.customer?.preDialogue ?? [];
    const dlg: DialogueNode[] = this.customer?.dialogue ?? [];
    if (pre.length > 0) {
      this.runLinearDialogue(pre, () => {
        if (dlg.length > 0) this.runDialogueWithChoices(dlg);
      });
    } else if (dlg.length > 0) {
      this.runDialogueWithChoices(dlg);
    }
  }

  // 선형(클릭) 대화
  private runLinearDialogue(lines: Line[], onDone?: () => void) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        this.hideBoxes();
        onDone?.();
        return;
      }
      const { who, text, sprite } = lines[i++];
      const isClient = (who === "client");

      if (isClient && sprite && this.customer?.sprites?.[sprite]) {
        this.client.setTexture(this.customer.sprites[sprite]);
      }
      this.showLine(isClient, text);
      this.textbox.removeAllListeners("pointerup");
      this.myTextbox.removeAllListeners("pointerup");
      this.textbox.on("pointerup", next);
      this.myTextbox.on("pointerup", next);
    };
    next();
  }

  // 선택지 대화(스무고개)
  private runDialogueWithChoices(dlg: DialogueNode[], onDone?: () => void) {
    const map = new Map<string, DialogueNode>();
    dlg.forEach(n => map.set(n.id, n));
    let curId = dlg[0].id;

    const showNode = (node: DialogueNode) => {
      const isClient = (node.who === "client");
      if (isClient && node.sprite && this.customer?.sprites?.[node.sprite]) {
        this.client.setTexture(this.customer.sprites[node.sprite]);
      }
      this.showLine(isClient, node.text);

      this.clearChoices();
      const choices = node.choices ?? [{ label: "네", next: "end" }];
      this.renderChoices(choices, (nextId) => {
        if (nextId === "end") {
          this.hideBoxes();
          this.clearChoices();
          onDone?.();
          return;
        }
        const next = map.get(nextId);
        if (!next) {
          this.hideBoxes();
          this.clearChoices();
          onDone?.();
          return;
        }
        curId = next.id;
        showNode(next);
      });
    };

    showNode(map.get(curId)!);
  }

  private renderChoices(choices: Choice[], onPick: (nextId: string) => void) {
    const baseY = this.POS.textbox.y + 80;
    const gap = 220;
    this.choiceButtons = [];

    choices.forEach((c, i) => {
      const x = this.POS.textbox.x + (i - (choices.length - 1) / 2) * gap;
      const container = this.add.container(x, baseY).setDepth(26);
      const bg = this.add.rectangle(0, 0, 180, 48, 0x2b1a3a, 0.9)
        .setStrokeStyle(2, 0x6E2B8B)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(0, 0, c.label, {
        fontFamily: "sans-serif", fontSize: "22px", color: "#F7E2B2"
      }).setOrigin(0.5);
      container.add([bg, label]);
      bg.on("pointerup", () => onPick(c.next));
      this.choiceButtons.push(container);
    });
  }

  private clearChoices() {
    this.choiceButtons.forEach(c => c.destroy());
    this.choiceButtons = [];
  }

  private showLine(isClient: boolean, text: string) {
    const box = isClient ? this.textbox : this.myTextbox;
    const color = isClient ? this.COLOR_CLIENT : this.COLOR_PLAYER;
    this.textbox.setVisible(isClient);
    this.myTextbox.setVisible(!isClient);
    this.children.getByName("dialogText")?.destroy();
    this.add.text(box.x, box.y - 10, text, {
      fontFamily: "sans-serif",
      fontSize: "32px",
      color,
      wordWrap: { width: 880, useAdvancedWrap: true },
      align: "center"
    }).setOrigin(0.5).setDepth(25).setName("dialogText");
  }

  private hideBoxes() {
    this.textbox.setVisible(false);
    this.myTextbox.setVisible(false);
    this.children.getByName("dialogText")?.destroy();
  }

  // 판정 + 에필로그
  private runJudgeFlow() {
    const C = this.customer;
    const stage = this.stageData;
    const pie = this.registry.get("pieState");

    if (!pie || !pie.cooked) {
      const lines: Line[] = [C?.failLine ?? { who: "client", text: "…아직 준비가 안 된 모양이군." }];
      if (stage.epilogueFail) lines.push(...stage.epilogueFail);
      this.playLinesThenResult(lines, false);
      return;
    }

    const o = C.order || {};
    const isFinal = stage?.id === 7;

    const fillingOk = isFinal ? (pie.filling === "pie_jam_magic") : (pie.filling === o.filling);
    const latticeOk  = o.ignoreLattice  || pie.lattice === o.needsLattice || (isFinal && o.ignoreLattice === true);
    const toppingOk  = o.ignoreToppings || (o.toppings ? o.toppings.every((t: string) => pie.toppings.includes(t)) : true) || (isFinal && o.ignoreToppings === true);

    const ok = pie.cooked && fillingOk && latticeOk && toppingOk;

    if (오케이) {
      const lines: Line[] = [C?.successLine ?? { who: "client", text: "좋아." }];
      if (stage.epilogueSuccess) lines.push(...stage.epilogueSuccess);
      this.playLinesThenResult(lines, true);
    } else {
      const lines: Line[] = [C?.failLine ?? { who: "client", text: "유감이군." }];
      if (stage.epilogueFail) lines.push(...stage.epilogueFail);
      this.playLinesThenResult(lines, false);
    }
  }

  private playLinesThenResult(lines: Line[], isSuccess: boolean) {
  let i = 0;
  const next = () => {
    if (i >= lines.length) {
      this.hideBoxes();

      // ✅ 통계 누적 코드 (여기에 추가)
      const summary = this.registry.get("scoreSummary") || { total: 0, good: 0, bad: 0 };
      summary.total += 1;
      if (isSuccess) summary.good += 1;
      else summary.bad += 1;
      this.registry.set("scoreSummary", summary);
      // ✅ 통계 누적 끝

      // 마지막 스테이지인지 확인
      const isLast = (this.stageData?.id === 7);

      if (isLast) {
        this.scene.start("Result"); // 엔딩으로
      } else {
        const nextStage = (this.stageData?.id || 1) + 1;
        this.registry.set("currentStage", nextStage);
        this.registry.set("pieState", null);
        this.scene.start("Hall"); // 다음 스테이지로
      }
      return;
    }

    const { who, text, sprite } = lines[i++];
    const isClient = (who === "client");
    if (isClient && sprite && this.customer?.sprites?.[sprite]) {
      this.client.setTexture(this.customer.sprites[sprite]);
    }
    this.showLine(isClient, text);
    this.textbox.removeAllListeners("pointerup");
    this.myTextbox.removeAllListeners("pointerup");
    this.textbox.on("pointerup", next);
    this.myTextbox.on("pointerup", next);
  };
  next();
}
  // 미리보기
  private renderPiePreview(preview: Phaser.GameObjects.Container, pvBottom: Phaser.GameObjects.Image, pvJam: Phaser.GameObjects.Image, pvTop: Phaser.GameObjects.Image) {
    const state: any = this.registry.get("pieState");
    if (state && state.hasDough) {
      preview.setVisible(true);
      pvBottom.setTexture(state.cooked ? "pie_bottom_cooked" : "pie_bottom_raw").setVisible(true);
      if (state.filling) pvJam.setTexture(state.filling).setVisible(true); else pvJam.setVisible(false);
      if (state.lattice) pvTop.setTexture(state.cooked ? "pie_top_cooked" : "pie_top_raw").setVisible(true); else pvTop.setVisible(false);
    } else {
      preview.setVisible(false);
      pvBottom.setVisible(false);
      pvJam.setVisible(false);
      pvTop.setVisible(false);
    }
  }
}
