import Phaser from "phaser";

export default class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // 예시 자산 로드
    this.load.image("hall_arrow", "assets/images/ui/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/ui/kitchen_arrow.png");

    // 실제론 여기서 네 모든 이미지 등록
  }

  create() {
    this.scene.start("MainMenu");
  }
}
