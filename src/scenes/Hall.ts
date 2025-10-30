// src/scenes/Hall.ts
import Phaser from "phaser";

export default class Hall extends Phaser.Scene {
  constructor() { super("Hall"); }

  // ── 좌표/레이어: 여기 숫자만 바꾸면 배치 조정 가능 ──
  private POS = {
    background: { x: 640, y: 360, depth: -1000 },
    counter:    { x: 640, y: 360, depth: 10 },
    client:     { x: 491, y: 298, depth: 1 },
    textbox:    { x: 960, y: 305, depth: 20 },
    textboxArrow:{ x:1179, y: 396, depth: 21 },
    myTextbox:  { x: 325, y: 550, depth: 22 },
    toKitchen:  { x:1220, y: 640, depth: 30 }, // 홀→주방 화살표(우하단). 필요시 좌표만 수정
  } as const;

  // 손님 순서: levin → cheongbi → liora → lorica → sonya → hide(2스테이지)
  private clientOrder = ["levin", "cheongbi", "liora", "lorica", "sonya", "hide"];
  private currentClientIndex = 0;

  // 말풍선 텍스트 색
  private COLOR_CLIENT = "#140605";
  private COLOR_PLAYER = "#F7E2B2";

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private textboxArrow!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  preload() {
    // 배경/UI
    this.load.image("hall_background",      "assets/images/hall_background.webp");
    this.load.image("hall_counter",         "assets/images/hall_counter.png");
    this.load.image("hall_textbox",         "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",       "assets/images/hall_mytextbox.png");
    this.load.image("hall_textbox_arrow",   "assets/images/hall_textbox_arrow.png");
    this.load.image("hall_arrow",           "assets/images/hall_arrow.png");

    // 손님 스프라이트(standard/happy/angry)
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

    // 첫 손님 표시
    this.client = this.add.image(this.POS.client.x, this.POS.client.y, this.clientKey("standard"))
      .setDepth(this.POS.client.depth)
      .setVisible(true);

    // 손님 말풍선
    this.textbox = this.add.image(this.POS.textbox.x, this.POS.textbox.y, "hall_textbox")
      .setDepth(this.POS.textbox.depth).setVisible(false);

    this.textboxArrow = this.add.image(this.POS.textboxArrow.x, this.POS.textboxArrow.y, "hall_textbox_arrow")
      .setDepth(this.POS.textboxArrow.depth)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    // 플레이어 말풍선
    this.myTextbox = this.add.image(this.POS.myTextbox.x, this.POS.myTextbox.y, "hall_mytextbox")
      .setDepth(this.POS.myTextbox.depth).setVisible(false);

    // 홀→주방 이동 화살표(페이드 없음)
    this.toKitchenArrow = this.add.image(this.POS.toKitchen.x, this.POS.toKitchen.y, "hall_arrow")
      .setDepth(this.POS.toKitchen.depth)
      .setInteractive({ useHandCursor: true });

    this.toKitchenArrow.on("pointerup", () => {
      this.scene.start("Stage"); // 주방으로 이동
    });

    // 테스트 대사(주문 JSON 붙이기 전 임시)
    this.showDialogueSequence([
      { who: "client", text: "어서와. 네 파이가 필요해." },
      { who: "player", text: "주문을 말씀해 주세요." },
      { who: "client", text: "…그 전에, 주방으로 가서 준비부터 해볼래?" }
    ]);
  }

  // 현재 손님 키 헬퍼
  private clientKey(state: "standard" | "happy" | "angry") {
    const name = this.clientOrder[this.currentClientIndex] ?? this.clientOrder[0];
    return `client_${name}_${state}`;
  }

  // 손님 교체(필요 시 호출)
  private setClient(index: number) {
    this.currentClientIndex = Phaser.Math.Clamp(index, 0, this.clientOrder.length - 1);
    this.client.setTexture(this.clientKey("standard"));
  }

  // happy/angry 연출용(판정 붙이면 여기서 텍스처 교체)
  private setClientMood(mood: "standard" | "happy" | "angry") {
    this.client.setTexture(this.clientKey(mood));
  }

  // 순차 대사 출력(자유 대사/주문 대사 공통 베이스)
  private showDialogueSequence(
    lines: { who: "client" | "player"; text: string }[],
    onComplete?: () => void
  ) {
    let i = 0;

    const draw = () => {
      if (i >= lines.length) {
        this.textbox.setVisible(false);
        this.myTextbox.setVisible(false);
        this.textboxArrow.setVisible(false);
        this.children.getByName("dialogText")?.destroy();
        onComplete?.();
        return;
      }

      const { who, text } = lines[i++];
      const isClient = who === "client";

      this.textbox.setVisible(isClient);
      this.myTextbox.setVisible(!isClient);
      this.textboxArrow.setVisible(true);

      // 이전 텍스트 제거
      this.children.getByName("dialogText")?.destroy();

      const box = isClient ? this.textbox : this.myTextbox;
      const color = isClient ? this.COLOR_CLIENT : this.COLOR_PLAYER;

      const t = this.add.text(box.x, box.y - 10, text, {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color,
        wordWrap: { width: 900 }
      }).setOrigin(0.5).setDepth(25).setName("dialogText");
    };

    // 말풍선 클릭 시 다음으로 넘어가기
    this.textbox.removeAllListeners("pointerup");
    this.myTextbox.removeAllListeners("pointerup");

    this.textbox.setInteractive({ useHandCursor: true });
    this.myTextbox.setInteractive({ useHandCursor: true });

    this.textbox.on("pointerup", draw);
    this.myTextbox.on("pointerup", draw);

    draw();
  }
}
