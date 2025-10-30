import Phaser from "phaser";

export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  preload() {
    this.load.image("ending_good",   "assets/images/ending_good.webp");
    this.load.image("ending_normal", "assets/images/ending_normal.webp");
    this.load.image("ending_bad",    "assets/images/ending_bad.webp");
  }

  create() {
    const summary = this.registry.get("scoreSummary") || { total: 0, good: 0, bad: 0 };

    let endingType = "normal";
    if (summary.good === summary.total) endingType = "good";
    else if (summary.bad === summary.total) endingType = "bad";
    else endingType = "normal";

    const key = `ending_${endingType}`;
    this.add.image(640, 360, key);

    // 클릭하면 게임 재시작
    this.input.once("pointerup", () => {
      this.registry.set("currentStage", 1);
      this.registry.set("pieState", null);
      this.registry.set("scoreSummary", { total: 0, good: 0, bad: 0 });
      this.scene.start("MainMenu");
    });
  }
}
