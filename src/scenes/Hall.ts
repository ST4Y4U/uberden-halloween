import Phaser from "phaser";

export default class Hall extends Phaser.Scene {
  constructor() {
    super("Hall");
  }

  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;
  private myTextbox!: Phaser.GameObjects.Image;
  private textboxArrow!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;
  private stageBox!: Phaser.GameObjects.Image;
  private stageNum!: Phaser.GameObjects.Image;

  preload() {
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("hall_counter", "assets/images/hall_counter.png");
    this.load.image("hall_textbox", "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox", "assets/images/hall_mytextbox.png");
    this.load.image("hall_textbox_arrow", "assets/images/hall_textbox_arrow.png");
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");
    this.load.image("hall_stage_box", "assets/images/hall_stage_box.png");

    this.load.image("client_test_standard", "assets/images/client_test_standard.png");
  }

  create() {
    // 배경, 카운터, 손님 배치
    this.add.image(640, 360, "hall_background").setDepth(-1000);
    this.add.image(640, 500, "hall_counter").setDepth(0);

    this.client = this.add.image(640, 300, "client_levin_standard").setDepth(1).setVisible(true);

    // 스테이지 표시
    this.stageBox = this.add.image(100, 80, "hall_stage_box").setDepth(10);
    this.stageNum = this.add.text(100, 80, "STAGE 1", {
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "#ffffff",
    }).setOrigin(0.5).setDepth(11);

    // 텍스트 박스 (손님)
    this.textbox = this.add.image(640, 590, "hall_textbox").setDepth(20).setVisible(false);
    this.textboxArrow = this.add.image(1120, 600, "hall_textbox_arrow")
      .setDepth(21).setVisible(false).setInteractive({ useHandCursor: true });

    // 플레이어 텍스트 박스
    this.myTextbox = this.add.image(640, 590, "hall_mytextbox").setDepth(22).setVisible(false);

    // 주방으로 이동하는 화살표 (페이드 없음)
    this.toKitchenArrow = this.add.image(1220, 640, "hall_arrow")
      .setDepth(30)
      .setInteractive({ useHandCursor: true });

    this.toKitchenArrow.on("pointerup", () => {
      this.scene.start("Stage");
    });

    // 테스트용 대화
    this.showDialogueSequence([
      { who: "client", text: "오늘도 파이 부탁할게요." },
      { who: "player", text: "주문 받았습니다." },
    ]);
  }

  private showDialogueSequence(lines: { who: "client" | "player"; text: string }[]) {
    let index = 0;

    const showLine = () => {
      if (index >= lines.length) {
        this.textbox.setVisible(false);
        this.myTextbox.setVisible(false);
        this.textboxArrow.setVisible(false);
        return;
      }

      const { who, text } = lines[index];
      const isClient = who === "client";
      this.textbox.setVisible(isClient);
      this.myTextbox.setVisible(!isClient);
      this.textboxArrow.setVisible(true);

      const existing = this.children.getByName("dialogText") as Phaser.GameObjects.Text;
      if (existing) existing.destroy();

      const box = isClient ? this.textbox : this.myTextbox;
      const txt = this.add.text(box.x, box.y - 10, text, {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffffff",
        wordWrap: { width: 900 },
      })
        .setOrigin(0.5)
        .setDepth(25)
        .setName("dialogText");

      index++;
    };

    this.textboxArrow.on("pointerup", showLine);
    showLine();
  }
}
