import Phaser from "phaser";

export default class Hall extends Phaser.Scene {
  constructor() { super("Hall"); }

  // 배치값 한 곳에서 관리
  private POS = {
    background: { x: 640, y: 360, depth: -1000 },
    counter:    { x: 640, y: 360, depth: 10 },
    client:     { x: 491, y: 298, depth: 1 },
    board:      { x: 820, y: 420, depth: 12 },  // 도마(항상 보임)
    pie:        { x: 820, y: 420, depth: 13 },  // 파이 미리보기(상태에 따라)
    textbox:    { x: 960, y: 305, depth: 20 },  // 손님 말풍선
    myTextbox:  { x: 325, y: 550, depth: 22 },  // 플레이어 말풍선
    toKitchen:  { x: 1220, y: 640, depth: 10000 }, // ▶ 홀→주방 화살표(우하단, 최상위)
  } as const;

  // 손님 순서 (고정)
  private clientOrder = ["levin", "cheongbi", "liora", "lorica", "sonya", "hide"];
  private currentClientIndex = 0;

  private COLOR_CLIENT = "#140605";
  private COLOR_PLAYER = "#F7E2B2";

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  preload() {
    // 홀 UI
    this.load.image("hall_background",  "assets/images/hall_background.webp");
    this.load.image("hall_counter",     "assets/images/hall_counter.png");
    this.load.image("hall_textbox",     "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",   "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow",       "assets/images/hall_arrow.png");

    // 도마/파이(미리보기용)
    this.load.image("pie_cuttingboard",     "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",       "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked",    "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",          "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",       "assets/images/pie_top_cooked.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);

    // 손님 스프라이트
    for (const c of this.clientOrder) {
      this.load.image(`client_${c}_standard`, `assets/images/client_${c}_standard.png`);
      this.load.image(`client_${c}_happy`,    `assets/images/client_${c}_happy.png`);
      this.load.image(`client_${c}_angry`,    `assets/images/client_${c}_angry.png`);
    }
  }

  create() {
    // 배경, 카운터
    this.add.image(this.POS.background.x, this.POS.background.y, "hall_background").setDepth(this.POS.background.depth);
    this.add.image(this.POS.counter.x,    this.POS.counter.y,    "hall_counter").setDepth(this.POS.counter.depth);

    // 손님
    this.client = this.add.image(this.POS.client.x, this.POS.client.y, this.clientKey("standard"))
      .setDepth(this.POS.client.depth);

    // 도마(항상 보임)
    this.add.image(this.POS.board.x, this.POS.board.y, "pie_cuttingboard")
      .setDepth(this.POS.board.depth)
      .setVisible(true);

    // 파이 미리보기 컨테이너
    const preview = this.add.container(this.POS.pie.x, this.POS.pie.y)
      .setDepth(this.POS.pie.depth)
      .setVisible(false);
    const pvBottom = this.add.image(0, -90, "pie_bottom_raw").setVisible(false);
    const pvJam    = this.add.image(0, -90, "pie_jam_apple").setVisible(false);
    const pvTop    = this.add.image(0, -90, "pie_top_raw").setVisible(false);
    preview.add([pvBottom, pvJam, pvTop]);

    // registry에서 파이 상태 복원 → 미리보기 렌더
    const state:any = this.registry.get("pieState");
    if (state && state.hasDough) {
      preview.setVisible(true);
      pvBottom.setTexture(state.cooked ? "pie_bottom_cooked" : "pie_bottom_raw").setVisible(true);
      if (state.filling) pvJam.setTexture(state.filling).setVisible(true);
      pvTop.setVisible(false);
      if (state.lattice) pvTop.setTexture(state.cooked ? "pie_top_cooked" : "pie_top_raw").setVisible(true);
    }

    // 말풍선(화살표 없이, 박스 클릭으로 진행)
    this.textbox = this.add.image(this.POS.textbox.x, this.POS.textbox.y, "hall_textbox")
      .setDepth(this.POS.textbox.depth).setVisible(false).setInteractive({ useHandCursor: true });
    this.myTextbox = this.add.image(this.POS.myTextbox.x, this.POS.myTextbox.y, "hall_mytextbox")
      .setDepth(this.POS.myTextbox.depth).setVisible(false).setInteractive({ useHandCursor: true });

    // ▶ 홀→주방 화살표 (최상위, 확실히 보이도록)
    this.toKitchenArrow = this.add.image(this.POS.toKitchen.x, this.POS.toKitchen.y, "hall_arrow")
      .setDepth(this.POS.toKitchen.depth)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setVisible(true);

    this.toKitchenArrow.on("pointerup", () => {
      this.scene.start("Stage");
    });

    // 입장 시 대화 (큰 글씨, 말풍선 클릭으로 넘김)
    this.playIntroDialogue();
  }

  private clientKey(state: "standard" | "happy" | "angry") {
    const name = this.clientOrder[this.currentClientIndex] ?? this.clientOrder[0];
    return `client_${name}_${state}`;
  }

  private playIntroDialogue() {
    const lines = [
      { who: "client" as const, text: "어서와. 네 파이가 필요해." },
      { who: "player" as const, text: "주문을 말씀해 주세요." },
    ];
    this.showDialogueSequence(lines);
  }

  private showDialogueSequence(
    lines: { who: "client" | "player"; text: string }[],
    onComplete?: () => void
  ) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        this.textbox.setVisible(false);
        this.myTextbox.setVisible(false);
        this.children.getByName("dialogText")?.destroy();
        onComplete?.();
        return;
      }
      const { who, text } = lines[i++];
      const isClient = who === "client";

      this.textbox.setVisible(isClient);
      this.myTextbox.setVisible(!isClient);
      this.children.getByName("dialogText")?.destroy();

      const box   = isClient ? this.textbox : this.myTextbox;
      const color = isClient ? this.COLOR_CLIENT : this.COLOR_PLAYER;

      this.add.text(box.x, box.y - 10, text, {
        fontFamily: "sans-serif",
        fontSize: "32px",
        color,
        wordWrap: { width: 880 },
        align: "center",
      }).setOrigin(0.5).setDepth(25).setName("dialogText");
    };

    this.textbox.removeAllListeners("pointerup");
    this.myTextbox.removeAllListeners("pointerup");
    this.textbox.on("pointerup", next);
    this.myTextbox.on("pointerup", next);

    next();
  }
}
