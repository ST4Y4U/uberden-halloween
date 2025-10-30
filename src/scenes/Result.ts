// src/scenes/Result.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state.ts";

export default class Result extends Phaser.Scene {
  constructor(){ super("Result"); }

  preload() {
    this.load.image("ending_good",   "assets/images/ending_good.png");
    this.load.image("ending_normal", "assets/images/ending_normal.png");
    this.load.image("ending_bad",    "assets/images/ending_bad.png");
  }

  create() {
    const gs = getGameState();
    const res = gs.result ?? "normal"; // 기본 노말

    const key =
      res === "good" ? "ending_good" :
      res === "bad"  ? "ending_bad"  : "ending_normal";

    this.add.image(640, 360, key).setDepth(0);

    this.add.text(640, 660, "화면을 누르면 다시 시작", {
      fontFamily: "sans-serif", fontSize: "24px", color: "#fff"
    }).setOrigin(0.5);

    this.input.once("pointerup", () => {
      // 초기화하고 메인메뉴로
      setGameState({ stageId: 1, kitchen: { pieState:null, pieReady:false }, result: undefined });
      this.scene.start("MainMenu");
    });
  }
}
