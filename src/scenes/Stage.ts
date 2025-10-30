// src/scenes/Stage.ts
import Phaser from "phaser";

/** --- 좌표 프리셋 (1280x720 기준) --- */
// 도마/파이 중심/판정
const BOARD_POS   = { x: 720,  y: 625 };  // 도마/파이 컨테이너 중심
const BOARD_HIT_R = 160;                  // 도마 원형 드랍 판정 반지름

// 오븐/소각/타이머
const OVEN_ZONE   = { x: 1040, y: 170, w: 356, h: 246 }; // 오븐 도어
const BURN_ZONE   = { x: 1040, y: 440, w: 285, h:  60 }; // 아래 불통
const TIMER_POS   = { x: 1040, y: 200 };                 // 타이머 표시

// 도우 선반(탭=모드 토글, 드래그=현재 모드 꺼내기)
const DOUGH_SHELF = { x: 680, y: 310, w: 140, h: 100 };

// 바구니(배경 포함 요소의 대략 중심/크기)
const BASKETS = {
  pumpkin:   { x: 146, y: 140, w: 120, h: 110 },
  raspberry: { x: 325, y: 140, w: 120, h: 110 },
  blueberry: { x: 500, y: 140, w: 120, h: 110 },
  strawberry:{ x: 680, y: 140, w: 120, h: 110 },
  pecan:     { x: 146, y: 310, w: 120, h: 110 },
  apple:     { x: 325, y: 310, w: 120, h: 110 },
  magic:     { x: 500, y: 310, w: 120, h: 110 }
};

// 토핑 바구니(하단 좌측)
const TOPPING_ZONES = {
  cherry:      { x:  90, y: 477, w: 95, h: 93 },
  sugarpowder: { x: 240, y: 477, w: 95, h: 93 },
  sprinkle:    { x: 390, y: 477, w: 95, h: 93 }
};

// 매직 키 (우하단 작은 열쇠)
const MAGIC_KEY = { x: 1240, y: 505, w: 57, h: 21 };

// ✅ 파이 시각 오프셋(컨테이너 내부 미세조정) — 도마 중심으로부터 위로 90px
const PIE_OFFSET   = { x: 0, y: -90 };
// 드래그 잡는 영역 미세조정(원하면 0으로)
const HIT_Y_OFFSET = 12;

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private isKitchen = false;

  // 배경/화살표
  private hallBg!: Phaser.GameObjects.Image;
  private kitchenBg!: Phaser.GameObjects.Image;
  private hallArrow!: Phaser.GameObjects.Image;
  private kitchenArrow!: Phaser.GameObjects.Image;

  // 홀 레이어
  private client!: Phaser.GameObjects.Image;
  private hallCounter!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;

  // 주방: 도마/파이
  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;

  // 주방: 오븐 타이머
  private ovenTimer!: Phaser.GameObjects.Image;
  private timerFrames = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];

  // 주방: 매직락/키
  private magicLocked = true;
  private magicLockImg!: Phaser.GameObjects.Image;

  // 상태
  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private doughMode: "dough" | "lattice" = "dough";

  preload() {
    // 배경
    this.load.image("hall_background",    "assets/images/hall_background.webp");
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");

    // 홀 오브젝트
    this.load.image("hall_counter",        "assets/images/hall_counter.png");
    this.load.image("hall_textbox",        "assets/images/hall_textbox.png");
    this.load.image("hall_textbox_arrow",  "assets/images/hall_textbox_arrow.png");
    this.load.image("client_basic_standard","assets/images/client_basic_standard.png");

    // 화살표
    this.load.image("hall_arrow",    "assets/images/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");

    // 파이/도마
    this.load.image("pie_cuttingboard",   "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",     "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked",  "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",        "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",     "assets/images/pie_top_cooked.png");

    // 재료(선반에서 꺼내는 토큰 텍스처)
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`,           `assets/images/pie_jam_${f}.png`);
    }
    this.load.image("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    // 토핑
    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    // 오븐 타이머
    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");

    // 매직 락/키
    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  create() {
    // 입력 안정화
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    // 배경
    this.hallBg = this.add.image(640,360,"hall_background").setOrigin(0.5).setDisplaySize(1280,720).setDepth(-10);
    this.kitchenBg = this.add.image(640,360,"kitchen_background").setOrigin(0.5).setDisplaySize(1280,720).setDepth(-10).setVisible(false);

    // 홀: 배경→손님→카운터→말풍선
    this.client      = this.add.image(640,360,"client_basic_standard").setDepth(10);
    this.hallCounter = this.add.image(640,600,"hall_counter").setDepth(15);
    this.textbox     = this.add.image(640,150,"hall_textbox").setDepth(20);

    // 화살표
    this.hallArrow    = this.add.image(1180, 640, "hall_arrow").setInteractive({useHandCursor:true}).setDepth(30);
    this.kitchenArrow = this.add.image(100,  640, "kitchen_arrow").setInteractive({useHandCursor:true}).setDepth(30).setVisible(false);
    this.hallArrow.on("pointerdown", () => this.toKitchen());
    this.kitchenArrow.on("pointerdown", () => this.toHall());

    // 도마/파이 컨테이너
    this.boardImg = this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10).setVisible(false);

    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 파이 컨테이너 드래그 가능
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(
      new Phaser.Geom.Rectangle(-160, -110 + HIT_Y_OFFSET, 320, 220),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(this.pieGroup, true);

    // 오븐/소각 드랍존
    const ovenZone = this.add.zone(OVEN_ZONE.x, OVEN_ZONE.y, OVEN_ZONE.w, OVEN_ZONE.h).setRectangleDropZone(OVEN_ZONE.w, OVEN_ZONE.h);
    const burnZone = this.add.zone(BURN_ZONE.x, BURN_ZONE.y, BURN_ZONE.w, BURN_ZONE.h).setRectangleDropZone(BURN_ZONE.w, BURN_ZONE.h);
    (ovenZone as any).name = "oven"; (burnZone as any).name = "burn";

    // 오븐 타이머
    this.ovenTimer = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1").setVisible(false).setDepth(20);

    // ── 드래그 토큰 스폰 유틸(Zone → Token) ──
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: () => string,
      onDrop: (token: Phaser.GameObjects.Image) => void
    ) => {
      let token: Phaser.GameObjects.Image | null = null;
      let dragged = false;

      zone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        dragged = true;
        const key = getKey();
        token = this.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(50)
          .setInteractive({ useHandCursor: true });
      });

      zone.on("drag", (pointer: Phaser.Input.Pointer) => {
        if (token) token.setPosition(pointer.worldX, pointer.worldY);
      });

      zone.on("dragend", () => {
        if (token) { onDrop(token); token.destroy(); token = null; }
        dragged = false;
      });

      return { wasDragged: () => dragged };
    };

    // ── 도우 선반: 탭=모드 토글, 드래그=현재 모드 꺼내기 ──
    const doughShelfZone = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(35);

    const doughCtrl = attachSpawnDrag(
      doughShelfZone,
      () => this.doughMode === "dough" ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice",
      (token) => {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        const key = token.texture.key;

        if (onBoard) {
          if (key === "kitchen_ingredient_dough") {
            this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
            this.pie.lattice = false; this.pie.toppings.clear();
            this.boardImg.setVisible(true); this.pieGroup.setVisible(true);
            this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
            this.pieJam.setVisible(false); this.pieTop.setVisible(false);
          } else if (key === "kitchen_ingredient_lattice" && this.pie.hasDough) {
            this.pie.lattice = true; this.pieTop.setTexture("pie_top_raw").setVisible(true);
          }
        }
      }
    );

    doughShelfZone.on("pointerup", () => {
      if (!doughCtrl.wasDragged()) {
        this.doughMode = this.doughMode === "dough" ? "lattice" : "dough";
        const label = this.add.text(DOUGH_SHELF.x, DOUGH_SHELF.y - 48,
          this.doughMode === "dough" ? "DOUGH" : "LATTICE",
          { fontFamily: "sans-serif", fontSize: "18px", color: "#6E2B8B" }
        ).setOrigin(0.5).setDepth(36);
        this.tweens.add({ targets: label, y: label.y - 24, alpha: 0, duration: 600, onComplete: () => label.destroy() });
      }
    });

    // ── 재료/토핑 바구니: 드래그=꺼내기 ──
    const makeIngredientBasket = (rect:{x:number;y:number;w:number;h:number}, texKey:string) => {
      const z = this.add.zone(rect.x, rect.y, rect.w, rect.h)
        .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(35);

      attachSpawnDrag(z, () => texKey, (token) => {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        if (!onBoard) return;

        if (texKey.startsWith("kitchen_ingredient_") && this.pie.hasDough) {
          const mapsTo = this.mapKitchenToJam(texKey);
          if (mapsTo) { this.pie.filling = mapsTo; this.pieJam.setTexture(mapsTo).setVisible(true); }
        } else if (texKey.startsWith("pie_ingredient_") && this.pie.cooked) {
          if (!this.pie.toppings.has(texKey)) {
            this.pie.toppings.add(texKey);
            const top = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, texKey).setDepth(23);
            this.pieGroup.add(top);
          }
        }
      });
    };

    // 과일/속
    makeIngredientBasket(BASKETS.pumpkin,   "kitchen_ingredient_pumpkin");
    makeIngredientBasket(BASKETS.raspberry, "kitchen_ingredient_raspberry");
    makeIngredientBasket(BASKETS.blueberry, "kitchen_ingredient_blueberry");
    makeIngredientBasket(BASKETS.strawberry,"kitchen_ingredient_strawberry");
    makeIngredientBasket(BASKETS.pecan,     "kitchen_ingredient_pecan");
    makeIngredientBasket(BASKETS.apple,     "kitchen_ingredient_apple");

    // 토핑
    makeIngredientBasket(TOPPING_ZONES.cherry,      "pie_ingredient_cherry");
    makeIngredientBasket(TOPPING_ZONES.sugarpowder, "pie_ingredient_sugarpowder");
    makeIngredientBasket(TOPPING_ZONES.sprinkle,    "pie_ingredient_sprinkle");

    // 매직 락/키
    this.magicLockImg = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(34).setVisible(true);
    this.magicLocked = true;

    const magicBasket = this.add.zone(BASKETS.magic.x, BASKETS.magic.y, BASKETS.magic.w, BASKETS.magic.h)
      .setOrigin(0.5).setInteractive({ draggable:true }).setDepth(33);
    attachSpawnDrag(magicBasket, () => {
      return this.magicLocked ? "" : "kitchen_ingredient_magic";
    }, (token) => {
      if (!this.magicLocked && this.pie.hasDough) {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        if (onBoard) {
          const mapsTo = this.mapKitchenToJam("kitchen_ingredient_magic");
          if (mapsTo) { this.pie.filling = mapsTo; this.pieJam.setTexture(mapsTo).setVisible(true); }
        }
      }
    });

    const keyZone = this.add.zone(MAGIC_KEY.x, MAGIC_KEY.y, MAGIC_KEY.w, MAGIC_KEY.h)
      .setOrigin(0.5).setInteractive({ draggable:true, useHandCursor:true }).setDepth(35);
    attachSpawnDrag(keyZone, () => "kitchen_magic_key", (token) => {
      const lockRect = new Phaser.Geom.Rectangle(BASKETS.magic.x-BASKETS.magic.w/2, BASKETS.magic.y-BASKETS.magic.h/2, BASKETS.magic.w, BASKETS.magic.h);
      if (Phaser.Geom.Intersects.RectangleToRectangle(token.getBounds(), lockRect)) {
        this.magicLocked = false;
        this.magicLockImg.setVisible(false);
      }
    });

    // ── 파이 이동(오븐/소각 판정) ──
    this.input.on("drag", (_p, g:any, x:number, y:number)=> g.setPosition(x,y));

    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;

      const pieRect  = this.pieGroup.getBounds();
      const ovenRect = new Phaser.Geom.Rectangle(OVEN_ZONE.x-OVEN_ZONE.w/2, OVEN_ZONE.y-OVEN_ZONE.h/2, OVEN_ZONE.w, OVEN_ZONE.h);
      const burnRect = new Phaser.Geom.Rectangle(BURN_ZONE.x-BURN_ZONE.w/2, BURN_ZONE.y-BURN_ZONE.h/2, BURN_ZONE.w, BURN_ZONE.h);

      if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, ovenRect) && this.pie.hasDough) {
        this.activateOvenTimer();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, burnRect)) {
        this.resetPie();
        this.boardImg.setVisible(false);
        this.pieGroup.setVisible(false);
      }
      // 항상 도마 위치로 스냅백
      this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
    });

    // 초기: 홀 화면
    this.setKitchenVisible(false);
  }

  private mapKitchenToJam(key:string): string | null {
    const suffix = key.replace("kitchen_ingredient_", "");
    return `pie_jam_${suffix}`;
  }

  private activateOvenTimer() {
    this.ovenTimer.setVisible(true).setTexture(this.timerFrames[0]);
    let i = 0;
    const tick = () => {
      i++;
      if (i < this.timerFrames.length) {
        this.ovenTimer.setTexture(this.timerFrames[i]);
        this.time.delayedCall(1000, tick);
      } else {
        this.ovenTimer.setVisible(false);
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked");
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked");
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private resetPie() {
    this.pie.hasDough = false; this.pie.cooked = false; this.pie.filling = null;
    this.pie.lattice = false; this.pie.toppings.clear();
    this.pieBottom.setVisible(false); this.pieJam.setVisible(false); this.pieTop.setVisible(false);
    // 토핑 이미지 정리
    this.pieGroup.getAll().forEach(ch=>{
      if (ch instanceof Phaser.GameObjects.Image && ch.texture.key.startsWith("pie_ingredient_")) ch.destroy();
    });
  }

  private toKitchen() {
    if (this.isKitchen) return;
    this.isKitchen = true;
    this.hallBg.setVisible(false);   this.kitchenBg.setVisible(true);
    this.hallArrow.setVisible(false); this.kitchenArrow.setVisible(true);
    this.client.setVisible(false);   this.hallCounter.setVisible(false); this.textbox.setVisible(false);
    this.setKitchenVisible(true);
  }

  private toHall() {
    if (!this.isKitchen) return;
    this.isKitchen = false;
    this.hallBg.setVisible(true);   this.kitchenBg.setVisible(false);
    this.hallArrow.setVisible(true); this.kitchenArrow.setVisible(false);
    this.client.setVisible(true);   this.hallCounter.setVisible(true); this.textbox.setVisible(true);
    this.setKitchenVisible(false);
  }

  private setKitchenVisible(v:boolean) {
    this.boardImg.setVisible(v || this.boardImg.visible);
    this.pieGroup.setVisible(v && this.pieGroup.visible);
    this.ovenTimer.setVisible(v && this.ovenTimer.visible);
    this.magicLockImg.setVisible(v && this.magicLocked);
  }
}
