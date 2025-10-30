import Phaser from "phaser";

export default class Boot extends Phaser.Scene {
  constructor(){ super("Boot"); }

  preload(){
    // 공용 UI/배경(중복 로드되어도 캐시됨)
    this.load.image("hall_background",  "assets/images/hall_background.webp");
    this.load.image("hall_counter",     "assets/images/hall_counter.png");
    this.load.image("hall_textbox",     "assets/images/hall_textbox.png");
    this.load.image("hall_mytextbox",   "assets/images/hall_mytextbox.png");
    this.load.image("hall_arrow",       "assets/images/hall_arrow.png");

    this.load.image("kitchen_background","assets/images/kitchen_background.webp");
    this.load.image("kitchen_arrow",    "assets/images/kitchen_arrow.png");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");

    this.load.image("pie_bottom_raw",   "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked","assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",      "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",   "assets/images/pie_top_cooked.png");

    // 엔딩 이미지(파일명: ending_*)
    this.load.image("ending_good",   "assets/images/ending_good.png");
    this.load.image("ending_normal", "assets/images/ending_normal.png");
    this.load.image("ending_bad",    "assets/images/ending_bad.png");

    // 손님 스프라이트(표정 세트)
    const names = ["levin","cheongbi","liora","lorica","sonya","hide"];
    const states = ["standard","happy","angry", "anxious", "changed"];
    for (const n of names) for (const s of states) {
      this.load.image(`client_${n}_${s}`, `assets/images/client_${n}_${s}.png`);
    }
  }

  create(){
    // 최초 진입 초기값 안전장치
    if (!this.registry.get("currentStage")) this.registry.set("currentStage", 1);
    if (!this.registry.get("scoreSummary")) this.registry.set("scoreSummary", { total:0, good:0, bad:0 });
    this.registry.set("pieState", null);

    this.scene.start("MainMenu");
  }
}
