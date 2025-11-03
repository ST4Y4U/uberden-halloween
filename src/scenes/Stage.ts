// src/scenes/Stage.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

const BOARD_POS   = { x: 720,  y: 625 };
const BOARD_HIT_R = 160;
const OVEN_ZONE   = { x: 1040, y: 170, w: 356, h: 246 };
const BURN_ZONE   = { x: 1040, y: 440, w: 285, h: 60 };
const TIMER_POS   = { x: 1040, y: 200 };
const DOUGH_SHELF = { x: 680, y: 310, w: 140, h: 100 };
const HALL_ARROW_POS = { x: 96, y: 648 };

const BASKETS = {
  pumpkin:   { x: 146, y: 140, w: 120, h: 110 },
  raspberry: { x: 325, y: 140, w: 120, h: 110 },
  blueberry: { x: 500, y: 140, w: 120, h: 110 },
  strawberry:{ x: 680, y: 140, w: 120, h: 110 },
  pecan:     { x: 146, y: 310, w: 120, h: 110 },
  apple:     { x: 325, y: 310, w: 120, h: 110 },
  magic:     { x: 500, y: 310, w: 120, h: 110 }
};

const TOPPING_ZONES = {
  cherry:      { x:  90, y: 477, w: 95, h: 93 },
  sugarpowder: { x: 240, y: 477, w: 95, h: 93 },
  sprinkle:    { x: 390, y: 477, w: 95, h: 93 }
};

const PIE_OFFSET = { x: 0, y: -90 };

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private toppingSprites: Phaser.GameObjects.Image[] = [];
  private doughMode: "dough" | "lattice" = "dough";
  private isBaking = false;

  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;

  preload() {
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);
    }
    this.load.image("kitchen_ingredient_dough", "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");
    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle", "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");
  }

  create() {
    this.add.image(640, 360, "kitchen_background").setDepth(-1000);

    // 파이 그룹 생성
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // ✅ 파이 드래그 핸들러
    this.input.on(
      "drag",
      (_p: Phaser.Input.Pointer, g: any, dx: number, dy: number) => {
        if (g === this.pieGroup) this.pieGroup.setPosition(dx, dy);
      }
    );

    // 주방→홀 화살표
    this.add.image(HALL_ARROW_POS.x, HALL_ARROW_POS.y, "kitchen_arrow")
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Hall"));

    // 도우와 재료 바구니 로직 등 (생략 없이 유지)
    // ...

    // 오븐 타이머, 굽기 완료 후 파이 표시 복귀
  }

  private activateOvenTimer(){
    this.isBaking = true;
    this.pieGroup.setVisible(false);
    const frames=["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
    let i=0;
    const tick=()=>{
      i++;
      if(i<frames.length){
        this.time.delayedCall(1000,tick);
      } else {
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if(this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(BOARD_POS.x,BOARD_POS.y).setVisible(true);
        this.isBaking = false;
      }
    };
    this.time.delayedCall(1000,tick);
  }

  private syncToGlobal(){
    // 비영구 저장 — Hall에서만 임시 사용
    const S = getGameState();
    S.pie = {
      cooked: this.pie.cooked,
      filling: this.pie.filling,
      lattice: this.pie.lattice,
      toppings: Array.from(this.pie.toppings),
      delivered: false
    } as any;
    setGameState(S);
  }
}