// src/scenes/MainMenu.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state.ts";

export default class MainMenu extends Phaser.Scene {
  constructor() { super("MainMenu"); }

  preload() {
    // 메인메뉴 전용 이미지 파일명: menu_main.png (public/assets/images/)
    // 파일명이 다르면 아래 경로/키를 네 파일명에 맞춰 바꿔.
    this.load.image("menu_main", "assets/images/mainmenu_background.webp");
  }

  create() {
    // 배경 이미지 표시
    this.add.image(640, 360, "menu_main").setDepth(0);

    // 안내 텍스트(선택)
    this.add.text(640, 660, "화면을 터치/클릭하면 시작합니다", {
      fontFamily: "sans-serif", fontSize: "24px", color: "#ffffff"
    }).setOrigin(0.5).setDepth(1);

    // 화면 아무데나 클릭/터치 → Hall로
    this.input.once("pointerup", () => {
      const s = getGameState();
      s.stageId = 1;
      // 필요하면 결과/파이 상태 초기화
      s.kitchen = { pieState: null, pieReady: false };
      s.result = undefined;
      setGameState(s);

      this.scene.start("Hall");
    });
  }
}
