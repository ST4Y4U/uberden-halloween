// src/scenes/Hall.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state.ts";
import { loadStageData, StageData, Line } from "../data/loadStage.ts";

const DEPTH = {
  BG: -1000,
  COUNTER: 5,
  CLIENT: 10,
  PIE: 12,
  MY_TEXT: 30,
  CL_TEXT: 31,
  ARROW: 40,
};

const MY_TEXT_STYLE   = { fontFamily: "sans-serif", fontSize: "28px", color: "#F7E2B2", wordWrap: { width: 520 } };
const CLNT_TEXT_STYLE = { fontFamily: "sans-serif", fontSize: "28px", color: "#140605", wordWrap: { width: 520 } };

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

  private stageData!: StageData;
  private client!: Phaser.GameObjects.Image;
  private myText!: Phaser.GameObjects.Text;
  private clText!: Phaser.GameObjects.Text;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  preload() {
    // 방어적 로드: 없으면 로드함(이미 있으면 무시됨)
    if (!this.textures.exists("hall_background"))
      this.load.image("hall_background", "assets/images/hall_background.webp");
    if (!this.textures.exists("hall_counter"))
      this.load.image("hall_counter", "assets/images/hall_counter.png");
    if (!this.textures.exists("hall_arrow"))
      this.load.image("hall_arrow", "assets/images/hall_arrow.png");

    // 최소 한 명의 손님 스프라이트 키가 없으면 기본 세트 로드
    ["client_levin_standard","client_levin_happy","client_levin_angry"].forEach(k=>{
      if (!this.textures.exists(k)) this.load.image(k, `assets/images/${k}.png`);
    });
  }

  async create() {
    this.input.topOnly = true;

    // 스테이지 데이터
    const S = getGameState();
    const stageId = S.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/카운터는 항상 맨 뒤
    this.add.image(640, 360, "hall_background").setDepth(DEPTH.BG);
    this.add.image(640, 360, "hall_counter").setDepth(DEPTH.COUNTER);

    // 손님 배치(좌표 기본값: 네가 준 값)
    const H = this.stageData.layout?.hall ?? {};
    const C0 = this.stageData.customers?.[0];
    const clientKey = C0?.sprites?.standard ?? "client_levin_standard";

    this.client = this.add.image(H.standX ?? 491, H.standY ?? 298, clientKey)
      .setDepth(DEPTH.CLIENT);

    // 텍스트 박스(텍스트만)
    this.myText = this.add.text(125, 483, "", MY_TEXT_STYLE)
      .setDepth(DEPTH.MY_TEXT).setVisible(false);
    this.clText = this.add.text(775, 205, "", CLNT_TEXT_STYLE)
      .setDepth(DEPTH.CL_TEXT).setVisible(false);

    // 주방으로 이동 화살표(우하) — JSON이 없으면 기본값
    const UI = this.stageData.ui ?? {};
    const arrowX = UI.arrowToKitchen?.x ?? 1184;
    const arrowY = UI.arrowToKitchen?.y ?? 648;

    this.toKitchenArrow = this.add.image(arrowX, arrowY, "hall_arrow")
      .setDepth(DEPTH.ARROW)
      .setInteractive({ useHandCursor: true });
    this.toKitchenArrow.on("pointerup", () => {
      this.scene.start("Stage");
    });

    // 프리 대사(있으면 터치로 넘김)
    const pre = Array.isArray(C0?.preDialogue) ? C0!.preDialogue : [];
    if (pre.length) this.playLines(pre);
  }

  // 간단 대사 플레이어
  private playLines(lines: Line[]) {
    let idx = 0;
    const show = (L: Line) => {
      // 스프라이트 바꿈
      const C0 = this.stageData.customers?.[0];
      if (L.sprite && C0?.sprites?.[L.sprite]) this.client.setTexture(C0.sprites[L.sprite]);

      if (L.who === "player") {
        this.myText.setText(L.text).setVisible(true);
        this.clText.setVisible(false);
      } else {
        this.clText.setText(L.text).setVisible(true);
        this.myText.setVisible(false);
      }
    };

    show(lines[idx]);
    const adv = () => {
      idx++;
      if (idx >= lines.length) {
        this.input.off("pointerup", adv);
        this.myText.setVisible(false);
        this.clText.setVisible(false);
        return;
      }
      show(lines[idx]);
    };
    this.input.on("pointerup", adv);
  }
}
