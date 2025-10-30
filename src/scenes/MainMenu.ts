// src/scenes/MainMenu.ts
import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor(){ super("MainMenu"); }

  preload(){
    this.load.image("menu_bg", "assets/images/menu_background.png"); // 네 파일명으로
  }

  create(){
    this.add.image(640, 360, "menu_bg").setDepth(-1000); // 배경은 인터랙티브 금지
    // 한 번 탭하면 시작
    this.input.once("pointerup", () => {
      // 안전장치: 스테이지 초기화
      if (!this.registry.get("currentStage")) this.registry.set("currentStage", 1);
      this.registry.set("pieState", null);
      this.registry.set("scoreSummary", { total: 0, good: 0, bad: 0 });

      this.scene.start("Hall");
    });
  }
}
