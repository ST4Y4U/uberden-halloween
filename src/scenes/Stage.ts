// src/scenes/Stage.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

const BOARD_POS   = { x: 720,  y: 625 };
const BOARD_HIT_R = 170;                 // 도마 판정 반경
const PIE_OFFSET  = { x: 0, y: -90 };

const HALL_ARROW_POS = { x: 96, y: 648 };

// 재료 바구니 위치
const BASKETS = {
  pumpkin:   { x: 146, y: 140, w: 120, h: 110 },
  raspberry: { x: 325, y: 140, w: 120, h: 110 },
  blueberry: { x: 500, y: 140, w: 120, h: 110 },
  strawberry:{ x: 680, y: 140, w: 120, h: 110 },
  pecan:     { x: 146, y: 310, w: 120, h: 110 },
  apple:     { x: 325, y: 310, w: 120, h: 110 },
  magic:     { x: 500, y: 310, w: 120, h: 110 } // 마법(스테이지7부터 해금)
};

// 토핑 영역
const TOPPING_ZONES = {
  cherry:      { x: 240, y: 620, w: 110, h: 100 },
  sprinkle:    { x: 480, y: 620, w: 110, h: 100 },
  sugarpowder: { x: 720, y: 620, w: 110, h: 100 }
};

export default class Stage extends Phaser.Scene {
  constructor(){ super("Stage"); }

  private pie = {
    hasDough: false,
    cooked: false,
    filling: null as string | null,
    lattice: false,
    toppings: new Set<string>()
  };

  private doughMode: "dough" | "lattice" = "dough";
  private isBaking = false;
  private magicUnlocked = false;

  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private toppingSprites: Phaser.GameObjects.Image[] = [];
  private magicLockImg?: Phaser.GameObjects.Image;

  preload(){
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");
    this.load.image("pie_cuttingboard",   "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",     "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked",  "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",        "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",     "assets/images/pie_top_cooked.png");

    // 필링/재료
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`,            `assets/images/pie_jam_${f}.png`);
    }
    this.load.image("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    // 토핑
    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    // 기타
    this.load.image("kitchen_arrow",     "assets/images/kitchen_arrow.png");
    this.load.image("kitchen_magic_lock","assets/images/kitchen_magic_lock.png"); // 잠금 아이콘
  }

  create(){
    // 스테이지7 이상이면 마법 해금
    const S = getGameState();
    const stageId = S.stageId || 1;
    this.magicUnlocked = stageId >= 7;

    this.input.topOnly = false;

    this.add.image(640, 360, "kitchen_background").setDepth(-1000);
    this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 파이 드래그 가능
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(
      new Phaser.Geom.Rectangle(-160,-110,320,220),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(this.pieGroup, true);
    this.pieGroup.on("drag", (_p:any, x:number, y:number)=> this.pieGroup.setPosition(x, y));

    // 홀로 이동
    this.add.image(HALL_ARROW_POS.x, HALL_ARROW_POS.y, "kitchen_arrow")
      .setInteractive({ useHandCursor:true })
      .on("pointerup", ()=> this.scene.start("Hall"));

    // ===== 드래그 스폰 유틸 =====
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: ()=>string|undefined,
      onDrop: (token: Phaser.GameObjects.Image)=>void
    )=>{
      let token: Phaser.GameObjects.Image | null = null;

      const move = (p: Phaser.Input.Pointer)=>{
        if (token) token.setPosition(p.worldX, p.worldY);
      };

      zone.on("pointerdown", (p: Phaser.Input.Pointer)=>{
        const key = getKey();
        if (!key) return;
        token = this.add.image(p.worldX, p.worldY, key).setDepth(101);
        this.input.on("pointermove", move);
      });

      zone.on("pointerup", ()=>{
        if (token) {
          onDrop(token);
          token.destroy();
          token = null;
        }
        this.input.off("pointermove", move);
      });

      zone.on("pointerout", ()=>{
        // 드래그 중 영역 벗어나도 계속 따라오도록 특별 처리 없음(포인터 기준)
      });
    };

    // 도마 내부 판정
    const onBoard = (x:number,y:number)=>{
      const dx = x - BOARD_POS.x;
      const dy = y - BOARD_POS.y;
      return (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
    };

    // ===== 도우 선반(토글식: 도우/격자) =====
    const DOUGH_SHELF = { x: 1160, y: 520, w: 140, h: 100 }; // 너가 쓰던 좌표에 맞춰 수정해도 됨
    const shelf = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor:true })
      .setDepth(100);

    // 탭으로 모드 전환
    let downTime=0, downX=0, downY=0, dragged=false;
    shelf.on("pointerdown",(p:any)=>{downTime=p.downTime;downX=p.worldX;downY=p.worldY;dragged=false;});
    shelf.on("pointermove",()=>{ /* noop */ });
    shelf.on("pointerup",(p:any)=>{
      const dt=p.upTime-downTime, dist=Math.hypot(p.worldX-downX,p.worldY-downY);
      if(!dragged && dt<250 && dist<8){
        this.doughMode = this.doughMode === "dough" ? "lattice" : "dough";
        const txt = this.add.text(DOUGH_SHELF.x, DOUGH_SHELF.y-48,
          this.doughMode.toUpperCase(),
          { fontFamily:"sans-serif", fontSize:"18px", color:"#6E2B8B" }
        ).setOrigin(0.5).setDepth(150);
        this.tweens.add({ targets: txt, y: txt.y-20, alpha: 0, duration: 500, onComplete:()=>txt.destroy() });
      }
    });

    attachSpawnDrag(shelf, ()=> this.doughMode==="dough" ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice", (token)=>{
      if (!onBoard(token.x, token.y)) return;
      if (this.pie.cooked) return;

      const key = token.texture.key;
      if (key === "kitchen_ingredient_dough") {
        if (this.pie.hasDough) return;
        this.pie.hasDough = true;
        this.pie.cooked   = false;
        this.pie.filling  = null;
        this.pie.lattice  = false;
        this.clearToppings();

        this.pieGroup.setVisible(true);
        this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
        this.pieJam.setVisible(false);
        this.pieTop.setVisible(false);
        this.syncToGlobal();
      } else if (key === "kitchen_ingredient_lattice") {
        if (!this.pie.hasDough) return;
        this.pie.lattice = true;
        this.pieTop.setTexture("pie_top_raw").setVisible(true);
        this.pieGroup.setVisible(true);
        this.syncToGlobal();
      }
    });

    // ===== 필링 바구니 =====
    const makeFillingBin = (r:{x:number;y:number;w:number;h:number}, tex:string)=>{
      const z = this.add.zone(r.x,r.y,r.w,r.h).setOrigin(0.5).setInteractive({ useHandCursor:true }).setDepth(100);
      attachSpawnDrag(z, ()=> tex, (token)=>{
        if (!onBoard(token.x, token.y)) return;
        if (tex === "kitchen_ingredient_magic" && !this.magicUnlocked) return; // 🔒 잠금
        if (!this.pie.hasDough || this.pie.cooked) return;

        const jam = `pie_jam_${tex.replace("kitchen_ingredient_","")}`;
        this.pie.filling = jam;
        this.pieJam.setTexture(jam).setVisible(true);
        this.pieGroup.setVisible(true);
        this.syncToGlobal();
      });
    };

    // 바구니 표시 + 잠금 아이콘
    Object.entries(BASKETS).forEach(([k, v])=>{
      makeFillingBin(v as any, `kitchen_ingredient_${k}`);
    });
    if (!this.magicUnlocked) {
      const lockPos = BASKETS.magic;
      this.magicLockImg = this.add.image(lockPos.x, lockPos.y, "kitchen_magic_lock").setDepth(101);
    }

    // ===== 토핑 영역 =====
    const makeToppingZone = (r:{x:number;y:number;w:number;h:number}, key:string)=>{
      const z = this.add.zone(r.x,r.y,r.w,r.h).setOrigin(0.5).setInteractive({ useHandCursor:true }).setDepth(100);
      attachSpawnDrag(z, ()=> key, (token)=>{
        if (!onBoard(token.x, token.y)) return;
        if (!this.pie.cooked) return;

        if (!this.pie.toppings.has(key)) {
          this.pie.toppings.add(key);
          const spr = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, key).setDepth(23);
          this.pieGroup.add(spr);
          this.toppingSprites.push(spr);
          this.pieGroup.setVisible(true);
          this.syncToGlobal();
        }
      });
    };
    Object.entries(TOPPING_ZONES).forEach(([k, v])=>{
      makeToppingZone(v as any, `pie_ingredient_${k}`);
    });
  }

  // 굽기 완료(타이머 등은 네 로직에 맞춰 호출)
  private activateOvenTimer(){
    this.isBaking = true;
    this.pieGroup.setVisible(false); // 굽는 동안 숨김

    // 네가 쓰는 타이머 프레임/지연 호출에 맞춰 구현
    const frames = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
    let i=0;
    const tick = ()=>{
      i++;
      if (i<frames.length) {
        this.time.delayedCall(1000, tick);
      } else {
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y).setVisible(true);
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
