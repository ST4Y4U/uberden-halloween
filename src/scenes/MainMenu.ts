import Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor(){ super("MainMenu"); }

  preload(){
    // 네가 준비한 메인 배경
    this.load.image("mainmenu_background", "assets/images/mainmenu_background.webp");
  }

  create(){
    this.add.image(640, 360, "menu_bg").setDepth(-1000);

    // 화면 어디든 클릭/터치 시 시작
    this.input.once("pointerup", () => {
      // 런타임 초기화
      this.registry.set("currentStage", 1);
      this.registry.set("pieState", null);
      this.registry.set("scoreSummary", { total:0, good:0, bad:0 });

      this.scene.start("Hall");
    });

    // 간단한 안내(선택)
    this.add.text(640, 640, "화면을 눌러 시작", {
      fontFamily:"sans-serif", fontSize:"20px", color:"#F7E2B2"
    }).setOrigin(0.5).setDepth(10);
  }
}
