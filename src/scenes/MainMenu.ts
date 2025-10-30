import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu"); // ★ 키 일치
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");

    const title = this.add.text(640, 260, "Uberden Halloween", {
      fontFamily: "sans-serif",
      fontSize: "48px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.add.text(640, 330, "Touch to Start", {
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "#aaaaaa"
    }).setOrigin(0.5);

    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.4 }, duration: 1000, yoyo: true, repeat: -1 });

    this.input.once("pointerdown", () => {
      this.scene.start("Stage"); // 다음 턴에 Stage 추가 예정
    });
  }
}
