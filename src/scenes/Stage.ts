import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

const BOARD_POS   = { x: 720,  y: 625 };
const BOARD_HIT_R = 160;
const PIE_OFFSET  = { x: 0, y: -90 };

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private pie = {
    hasDough: false,
    cooked: false,
    filling: null as string | null,
    lattice: false,
    toppings: new Set<string>()
  };

  private doughMode: "dough" | "lattice" = "dough";
  private isBaking = false;

  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private toppingSprites: Phaser.GameObjects.Image[] = [];

  preload() {
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

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

    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");
  }

  create() {
    this.add.image(640, 360, "kitchen_background").setDepth(-1000);
    this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너 기본 설정
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y)
      .setDepth(22)
      .setVisible(false);

    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // ✅ 드래그 영역/핸들러
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(
      new Phaser.Geom.Rectangle(-160, -110, 320, 220),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(this.pieGroup, true);
    this.pieGroup.on("drag", (_p:any, x:number, y:number)=> this.pieGroup.setPosition(x,y));

    // 주방→홀 화살표
    this.add.image(96, 648, "kitchen_arrow")
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Hall"));

    // 예시: 도우 재료를 도마로 드래그 시 파이 생성
    this.input.on("drop-dough", (_:any, key:string)=>{
      if (this.isBaking || this.pie.cooked) return;
      if (key === "kitchen_ingredient_dough" && !this.pie.hasDough) {
        this.pie.hasDough = true;
        this.pie.cooked = false;
        this.pie.filling = null;
        this.pie.lattice = false;
        this.pie.toppings.clear();

        this.pieGroup.setVisible(true);
        this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
        this.pieJam.setVisible(false);
        this.pieTop.setVisible(false);
        this.syncToGlobal();
      }
    });

    // ✅ 가상 예시: 필링/토핑 적용 함수 호출 시 visible 유지
    this.events.on("apply-filling", (_:any, jam:string)=>{
      if (!this.pie.hasDough || this.pie.cooked) return;
      this.pie.filling = jam;
      this.pieJam.setTexture(jam).setVisible(true);
      this.pieGroup.setVisible(true);
      this.syncToGlobal();
    });

    this.events.on("apply-topping", (_:any, topping:string)=>{
      if (!this.pie.cooked) return;
      if (!this.pie.toppings.has(topping)) {
        this.pie.toppings.add(topping);
        const spr = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, topping).setDepth(23);
        this.pieGroup.add(spr);
        this.toppingSprites.push(spr);
        this.pieGroup.setVisible(true);
        this.syncToGlobal();
      }
    });
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
        this.syncToGlobal();
      }
    };
    this.time.delayedCall(1000,tick);
  }

  private syncToGlobal(){
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