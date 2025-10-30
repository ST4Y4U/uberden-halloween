// src/scenes/Hall.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state.ts";
import { loadStageData, StageData, Line } from "../data/loadStage.ts";

const DEPTH = {
  BG: -1000,
  COUNTER: 5,
  CLIENT: 10,
  PIE: 12,          // (홀에서 도마/파이 보일 때)
  MY_BOX: 30,
  CLIENT_BOX: 31,
  ARROW: 40,
};

const MY_TEXT_STYLE   = { fontFamily: "sans-serif", fontSize: "28px", color: "#F7E2B2", wordWrap: { width: 520 } };
const CLNT_TEXT_STYLE = { fontFamily: "sans-serif", fontSize: "28px", color: "#140605", wordWrap: { width: 520 } };

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

  private stageData!: StageData;
  private client!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Text;
  private mybox!: Phaser.GameObjects.Text;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  // 대사 진행용
  private lines: Line[] = [];
  private lineIdx = 0;

  async create() {
    this.input.topOnly = true;

    // 스테이트/스테이지 로드
    const S = getGameState();
    const stageId = S.stageId || 1;
    this.stageData = await loadStageData(stageId);
    const H = this.stageData.layout?.hall ?? {};
    const UI = this.stageData.ui ?? { arrowToKitchen: {x:1184,y:648} };

    // 배경/카운터
    this.add.image(640, 360, "hall_background").setDepth(DEPTH.BG);
    this.add.image(640, 360, "hall_counter").setDepth(DEPTH.COUNTER);

    // 손님 스프라이트
    const C = this.stageData.customers?.[0];
    const clKey = C?.sprites?.standard ?? "client_levin_standard";
    this.client = this.add.image(H.standX ?? 491, H.standY ?? 298, clKey).setDepth(DEPTH.CLIENT);

    // 텍스트 박스(텍스트만, 말풍선 이미지는 배경에 포함되어 있으므로 좌표만 맞춰서)
    // 플레이어(좌 하단)
    this.mybox = this.add.text(125, 483, "", MY_TEXT_STYLE).setDepth(DEPTH.MY_BOX).setVisible(false);
    // 손님(우 상단)
    this.textbox = this.add.text(775, 205, "", CLNT_TEXT_STYLE).setDepth(DEPTH.CLIENT_BOX).setVisible(false);

    // 주방으로 가는 화살표 (JSON 좌표 사용)
    this.toKitchenArrow = this.add.image(
      UI.arrowToKitchen?.x ?? 1184,
      UI.arrowToKitchen?.y ?? 648,
      "hall_arrow"
    ).setDepth(DEPTH.ARROW).setInteractive({ useHandCursor: true });

    this.toKitchenArrow.on("pointerup", () => {
      this.scene.start("Stage"); // 주방으로
    });

    // 주문 이전 프리대사 → 주문대사(선택지) 대신 “터치로 넘기기” 최소형
    this.lines = Array.isArray(C?.preDialogue) ? C!.preDialogue : [];
    this.lineIdx = 0;
    if (this.lines.length > 0) {
      this.showLine(this.lines[this.lineIdx]);
      this.input.on("pointerup", this.advanceLineOnce);
    }
  }

  private advanceLineOnce = () => {
    this.lineIdx++;
    if (this.lineIdx >= this.lines.length) {
      // 프리대사 종료
      this.input.off("pointerup", this.advanceLineOnce);
      this.textbox.setVisible(false);
      this.mybox.setVisible(false);
      return;
    }
    this.showLine(this.lines[this.lineIdx]);
  };

  private showLine(L: Line) {
    if (!L) return;
    // 스프라이트 전환
    const C0 = this.stageData.customers?.[0];
    if (L.sprite && C0?.sprites?.[L.sprite]) {
      this.client.setTexture(C0.sprites[L.sprite]);
    }

    if (L.who === "player") {
      this.mybox.setText(L.text).setVisible(true);
      this.textbox.setVisible(false);
    } else {
      this.textbox.setText(L.text).setVisible(true);
      this.mybox.setVisible(false);
    }
  }
}
