import Phaser from "phaser";

export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  preload() {
    this.load.image("ending_good",   "assets/images/ending_good.webp");
    this.load.image("ending_normal", "assets/images/ending_normal.webp");
    this.load.image("ending_bad",    "assets/images/ending_bad.webp");
  }

  create() {
    // registry에 "endingType" = "good" | "normal" | "bad"
    const ending: "good" | "normal" | "bad" =
      this.registry.get("endingType") ?? "normal";

    this.add.image(640, 360, `ending_${ending}`);

    // 클릭하면 메인 메뉴로
    this.input.once("pointerup", () => this.scene.start("MainMenu"));
  }
}
