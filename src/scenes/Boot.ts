import Phaser from "phaser";

export default class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // (나중에 자산 로드 추가)
  }

  create() {
    this.add.text(640, 360, "Boot Scene", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // ★ 바로 메인메뉴로 전환 (딜레이 없어도 됨)
    this.scene.start("MainMenu");
  }
}
