import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  create() {
    // 배경 (지금은 단색, 나중에 이미지로 교체 가능)
    this.cameras.main.setBackgroundColor("#000000");

    // 타이틀 텍스트
    const title = this.add.text(640, 260, "Uberden Halloween", {
      fontFamily: "sans-serif",
      fontSize: "48px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // 서브 텍스트
    this.add.text(640, 330, "Touch to Start", {
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "#aaaaaa"
    }).setOrigin(0.5);

    // 간단한 점멸 효과
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.4 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    // 터치/클릭 시 Stage 씬으로 전환
    this.input.once("pointerdown", () => {
      this.scene.start("Stage");
    });
  }
}