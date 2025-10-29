import Phaser from "phaser";

export default class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // 예시: UI 화살표 이미지 로드
    this.load.image("hall_arrow", "assets/images/ui/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/ui/kitchen_arrow.png");

    // 실제로는 나중에 네가 올려둔 모든 자산들을 여기에 this.load.image()로 추가할 거야.
  }

  create() {
    // 임시로 화면에 텍스트 하나 표시
    this.add.text(640, 360, "Boot Scene", {
      fontFamily: "sans-serif",
      fontSize: "28px",
      color: "#ffffff"
    }).setOrigin(0.5);

    // 잠깐 대기 후 다음 씬으로 전환 (나중에 MainMenu.ts 연결 예정)
    this.time.delayedCall(1500, () => {
      this.scene.start("MainMenu");
    });
  }
}
