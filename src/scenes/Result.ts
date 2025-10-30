import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

export default class Result extends Phaser.Scene {
  constructor(){ super("Result"); }

  create(data: any) {
    const kind = (data?.result === "good" || data?.result === "bad") ? data.result : "normal";
    this.add.rectangle(640,360,1280,720,0x000000).setDepth(-10);
    const img = this.add.image(640,360,`ending_${kind}`).setDepth(0).setOrigin(0.5);
    this.tweens.add({ targets: img, alpha: {from:0,to:1}, duration: 600 });

    this.input.once("pointerup", ()=> this.scene.start("MainMenu"));
  }
}
