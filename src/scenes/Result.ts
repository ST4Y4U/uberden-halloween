// src/scenes/Result.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

export default class Result extends Phaser.Scene {
  constructor() {
    super("Result");
  }

  create(data: any) {
    // 전달받은 결과값 (Stage/Hall에서 this.scene.start("Result", { result: "good" }) 식으로 넘김)
    const resultKind = data?.result || "normal"; // 기본값 normal

    // 배경을 검은색으로 덮기 (플래시 방지용)
    this.add.rectangle(640, 360, 1280, 720, 0x000000).setDepth(-10);

    // 엔딩 이미지 출력
    const key = `ending_${resultKind}`; // ending_good / ending_normal / ending_bad
    const endingImage = this.add.image(640, 360, key).setDepth(0);
    endingImage.setOrigin(0.5);

    // 전환 연출 (페이드인)
    this.tweens.add({
      targets: endingImage,
      alpha: { from: 0, to: 1 },
      duration: 800,
      ease: "Sine.easeOut"
    });

    // 결과 기록 (통계 누적)
    const G = getGameState();
    if (!G.stats) G.stats = { good: 0, normal: 0, bad: 0 };
    if (resultKind in G.stats) G.stats[resultKind]++;
    setGameState(G);

    // 클릭 시 메인 메뉴로 복귀
    this.input.once("pointerup", () => {
      // 씬 초기화
      this.scene.start("MainMenu");
    });
  }
}
