import Phaser from "phaser";

export default class Hall extends Phaser.Scene {
  constructor() { super("Hall"); }

  // 좌표/레이어 (필요시 숫자만 수정)
  private POS = {
    background:   { x: 640, y: 360, depth: -1000 },
    counter:      { x: 640, y: 360, depth: 10 },
    client:       { x: 491, y: 298, depth: 1 },
    textbox:      { x: 960, y: 305, depth: 20 }, // 손님
    myTextbox:    { x: 325, y: 550, depth: 22 }, // 플레이어
    toKitchen:    { x: 1220, y: 640, depth: 30 }, // 필요시 좌표 바꿔
  } as const;

  // 손님 순서(요청 고정): levin → cheongbi → liora → lorica → sonya → hide
  private clientOrder = ["levin", "cheongbi", "liora", "lorica", "sonya", "hide"];
  private currentClientIndex = 0;

  // 말풍선 텍스트 색
  private COLOR_CLIENT = "#140605";
  private COLOR_PLAYER = "#F7E2B2";

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;

  preload() {
    this.load.image("hall_background",    "assets/images/hall_background.webp");
    this.load.image("hall_counter",       "assets/images/hall_counter.png");
    this.load.image("hall_textbox",       "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",     "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow",         "assets/images/hall_arrow.png"); // 필요시 사용

    // 손님 스프라이트
    for (const c of this.clientOrder) {
      this.load.image(`client_${c}_standard`, `assets/images/client_${c}_standard.png`);
      this.load.image(`client_${c}_happy`,    `assets/images/client_${c}_happy.png`);
      this.load.image(`client_${c}_angry`,    `assets/images/client_${c}_angry.png`);
    }
  }

  create() {
    // 배경, 카운터
    this.add.image(this.POS.background.x, this.POS.background.y, "hall_background")
      .setDepth(this.POS.background.depth);
    this.add.image(this.POS.counter.x, this.POS.counter.y, "hall_counter")
      .setDepth(this.POS.counter.depth);

    // 첫 손님
    this.client = this.add.image(this.POS.client.x, this.POS.client.y, this.clientKey("standard"))
      .setDepth(this.POS.client.depth)
      .setVisible(true);

    // 텍스트 박스(손님/플레이어). 화살표는 사용 안 함
    this.textbox = this.add.image(this.POS.textbox.x, this.POS.textbox.y, "hall_textbox")
      .setDepth(this.POS.textbox.depth).setVisible(false);
    this.myTextbox = this.add.image(this.POS.myTextbox.x, this.POS.myTextbox.y, "hall_mytextbox")
      .setDepth(this.POS.myTextbox.depth).setVisible(false);

    // 말풍선 자체 클릭으로 진행
    this.textbox.setInteractive({ useHandCursor: true });
    this.myTextbox.setInteractive({ useHandCursor: true });

    // “홀 입장 시마다 대화 재생” — 여기서 호출
    this.playIntroDialogue();
  }

  // 입장 시 재생되는 간단한 대화(나중에 JSON으로 교체 예정)
  private playIntroDialogue() {
    const lines: { who: "client" | "player"; text: string }[] = [
      { who: "client", text: "어서와. 네 파이가 필요해." },
      { who: "player", text: "주문을 말씀해 주세요." },
    ];
    this.showDialogueSequence(lines, () => {
      // 대화 끝나면 주방으로 가는 버튼을 화면 어딘가에 띄우거나,
      // 혹은 사용자 조작 기다렸다가 주방으로 이동하도록 설계 가능.
      // 지금은 ‘주방에서 화살표로 이동’ 흐름을 유지.
    });
  }

  private clientKey(state: "standard" | "happy" | "angry") {
    const name = this.clientOrder[this.currentClientIndex] ?? this.clientOrder[0];
    return `client_${name}_${state}`;
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

      // 기존 텍스트 제거
      this.children.getByName("dialogText")?.destroy();

      const box = isClient ? this.textbox : this.myTextbox;
      const color = isClient ? this.COLOR_CLIENT : this.COLOR_PLAYER;

      this.add.text(box.x, box.y - 10, text, {
        fontFamily: "sans-serif",
        fontSize: "32px",          // ← 크게
        color,
        wordWrap: { width: 880 },  // 텍스트 영역 줄바꿈 폭
        align: "center",
      }).setOrigin(0.5).setDepth(25).setName("dialogText");
    };

    // 말풍선 클릭으로 다음 진행
    this.textbox.removeAllListeners("pointerup");
    this.myTextbox.removeAllListeners("pointerup");
    this.textbox.on("pointerup", next);
    this.myTextbox.on("pointerup", next);

    next();
  }
}
