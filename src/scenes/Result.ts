import Phaser from "phaser";

export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  create(data: { ending: "good"|"normal"|"bad"; good: number; bad: number; }) {
    const msg = data.ending === "good" ? "GOOD END" : data.ending === "bad" ? "BAD END" : "NORMAL END";
    this.add.text(640, 300, msg, { fontFamily: "sans-serif", fontSize: "48px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(640, 360, `GOOD: ${data.good} / BAD: ${data.bad}`, { fontFamily: "sans-serif", fontSize: "24px", color: "#aaaaaa" }).setOrigin(0.5);
    this.add.text(640, 420, "Click to Title", { fontFamily: "sans-serif", fontSize: "20px", color: "#aaaaaa" }).setOrigin(0.5);
    this.input.once("pointerdown", () => this.scene.start("MainMenu"));
  }
}
