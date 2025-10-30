import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() { super("MainMenu"); }

  preload() {
    this.load.image("mainmenu_background", "assets/images/mainmenu_background.webp");
  }

  create() {
    this.add.image(640, 360, "mainmenu_background").setDepth(-10);

    // 센터 근처 클릭 시 게임 시작
    this.add.zone(640, 360, 480, 360)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Hall"));
  }
}
