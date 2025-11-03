// src/scenes/Stage.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

const BOARD_POS   = { x: 720,  y: 625 };
const BOARD_HIT_R = 160;
const OVEN_ZONE   = { x: 1040, y: 170, w: 356, h: 246 };
const BURN_ZONE   = { x: 1040, y: 440, w: 285, h: 60 };
const HALL_ARROW_POS = { x: 96, y: 648 };
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

    // 도마
    this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 드래그(컨테이너 자체)
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(new Phaser.Geom.Rectangle(-160,-110,320,220), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(this.pieGroup, true);
    this.pieGroup.on("drag", (_p:any, x:number, y:number)=> this.pieGroup.setPosition(x,y));

    // 홀로 이동
    this.add.image(HALL_ARROW_POS.x, HALL_ARROW_POS.y, "kitchen_arrow")
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Hall"));

    // 간단한 투척/적용 로직(핵심만 유지):
    // 도우 토큰 드롭 → 바닥 표시, 격자 토큰 드롭 → 상단 표시
    this.input.on("gameobjectdown", (_p:any, go:Phaser.GameObjects.Image)=>{
      const key = go.texture?.key;
      if (!key) return;
      // 여긴 필요 시 재료 버튼 UI를 추가했을 때 사용
    });

    // 예시: 키 입력으로 간단 조립(테스트 목적)
    this.input.keyboard?.on("keydown-D", ()=>{ // Dough
      if (this.pie.cooked) return;
      this.pie.hasDough = true; this.pie.cooked=false; this.pie.filling=null; this.pie.lattice=false;
      this.clearToppings();
      this.pieGroup.setVisible(true);
      this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
      this.pieJam.setVisible(false);
      this.pieTop.setVisible(false);
      this.syncToGlobal();
    });
    this.input.keyboard?.on("keydown-L", ()=>{ // Lattice
      if (!this.pie.hasDough || this.pie.cooked) return;
      this.pie.lattice = true;
      this.pieTop.setTexture("pie_top_raw").setVisible(true);
      this.syncToGlobal();
    });
    this.input.keyboard?.on("keydown-F", ()=>{ // Filling: apple
      if (!this.pie.hasDough || this.pie.cooked) return;
      this.pie.filling = "pie_jam_apple";
      this.pieJam.setTexture("pie_jam_apple").setVisible(true);
      this.syncToGlobal();
    });
    this.input.keyboard?.on("keydown-T", ()=>{ // Topping: sugarpowder
      if (!this.pie.cooked) return;
      if (!this.pie.toppings.has("pie_ingredient_sugarpowder")){
        this.pie.toppings.add("pie_ingredient_sugarpowder");
        const t = this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,"pie_ingredient_sugarpowder").setDepth(23);
        this.pieGroup.add(t); this.toppingSprites.push(t);
        this.syncToGlobal();
      }
    });
    this.input.keyboard?.on("keydown-B", ()=>{ // Bake
      if (!this.pie.hasDough) return;
      this.activateOvenTimer();
    });
  }

  private activateOvenTimer(){
    if (this.isBaking) return;
    this.isBaking = true;
    // 요청: 굽는 동안 파이 숨기지 않음
    // 간단 타이머 4초
    let t = 0;
    const tick = () => {
      t++;
      if (t < 4) this.time.delayedCall(1000, tick);
      else {
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.isBaking = false;
        this.syncToGlobal();
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private clearToppings(){
    for (const s of this.toppingSprites) s.destroy();
    this.toppingSprites.length = 0;
    this.pie.toppings.clear();
  }

  private syncToGlobal(){
    // 비영구 저장(메모리). Hall에서 읽고 바로 소비.
    const S = getGameState();
    S.pie = {
      cooked:  this.pie.cooked,
      filling: this.pie.filling,
      lattice: this.pie.lattice,
      toppings: Array.from(this.pie.toppings),
      delivered: false
    } as any;
    setGameState(S);
  }
}