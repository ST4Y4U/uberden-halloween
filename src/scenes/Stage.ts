// src/scenes/Stage.ts
import Phaser from "phaser";

// ===== 좌표 정의 =====
const BOARD_POS   = { x: 720,  y: 625 };
const BOARD_HIT_R = 160;
const OVEN_ZONE   = { x: 1040, y: 170, w: 356, h: 246 };
const BURN_ZONE   = { x: 1040, y: 440, w: 285, h: 60 };
const TIMER_POS   = { x: 1040, y: 200 };
const DOUGH_SHELF = { x: 680, y: 310, w: 140, h: 100 };

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

const MAGIC_KEY = { x: 1240, y: 505, w: 57, h: 21 };
const PIE_OFFSET = { x: 0, y: -90 };

// ===== 스테이지 플래그(보스 판정) =====
// (원하면 Boot/Main에서 this.registry.set("stage", n)으로 주입)
const getStageFromRegistry = (): number => {
  try {
    const w = window as unknown as { STAGE?: number };
    if (typeof w?.STAGE === "number") return w.STAGE!;
  } catch {}
  return 1;
};
const STAGE = getStageFromRegistry();
const IS_BOSS_STAGE = STAGE >= 6; // 6~7 보스

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private pie = {
    hasDough: false,
    cooked:   false,
    filling:  null as string | null,
    lattice:  false,
    toppings: new Set<string>()
  };
  private toppingSprites: Phaser.GameObjects.Image[] = [];
  private doughMode: "dough" | "lattice" = "dough";
  private magicLocked = true; // 시작 잠금
  private isBaking = false;   // 오븐 동작 중

  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;
  private magicLockImg!: Phaser.GameObjects.Image;

  preload() {
    this.load.image("kitchen_background",      "assets/images/kitchen_background.webp");
    this.load.image("pie_cuttingboard",        "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw",          "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked",       "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw",             "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked",          "assets/images/pie_top_cooked.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`,            `assets/images/pie_jam_${f}.png`);
    }
    this.load.image("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");

    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  create() {
    // 입력 설정
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    // 배경은 절대 뒤
    this.add.image(640, 360, "kitchen_background").setOrigin(0.5).setDepth(-1000);

    // 도마 상시 표시
    this.boardImg = this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10).setVisible(true);

    // 파이 컨테이너(+히트영역)
    this.pieGroup  = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(
      new Phaser.Geom.Rectangle(-160, -110, 320, 220),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(this.pieGroup, true);

    // 드래그 중 파이 위치 갱신
    this.input.on("drag", (_pointer, g: any, dragX: number, dragY: number) => {
      if (g === this.pieGroup) this.pieGroup.setPosition(dragX, dragY);
    });

    // 오븐 타이머/락 이미지
    this.ovenTimer    = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1").setVisible(false).setDepth(20);
    this.magicLockImg = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(18).setVisible(true);

    // ===== 토큰 생성 유틸(드롭 즉시 소멸) =====
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: () => string,
      onDrop: (token: Phaser.GameObjects.Image) => void
    ) => {
      let token: Phaser.GameObjects.Image | null = null;
      const move = (p: Phaser.Input.Pointer) => { if (token) token.setPosition(p.worldX, p.worldY); };

      zone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        const key = getKey();
        if (!key) return;
        token = zone.scene.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(101)
          .setInteractive({ useHandCursor: true });
        zone.scene.input.on("pointermove", move);
      });

      zone.on("drag", (pointer: Phaser.Input.Pointer) => move(pointer));

      zone.on("dragend", () => {
        if (token) {
          onDrop(token);
          token.setVisible(false);
          token.destroy();
          token = null;
        }
        zone.scene.input.off("pointermove", move);
      });
    };

    // ===== 도우 선반(탭=토글, 드래그=현재 모드 꺼내기) =====
    const doughShelfZone = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(100);
    this.input.setDraggable(doughShelfZone, true);

    let downTime = 0, downX = 0, downY = 0, startedDrag = false;
    doughShelfZone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      downTime = p.downTime; downX = p.worldX; downY = p.worldY; startedDrag = false;
    });
    doughShelfZone.on("dragstart", () => { startedDrag = true; });
    doughShelfZone.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dt = p.upTime - downTime;
      const dist = Math.hypot(p.worldX - downX, p.worldY - downY);
      if (!startedDrag && dt < 250 && dist < 8) {
        this.doughMode = this.doughMode === "dough" ? "lattice" : "dough";
        const txt = this.add.text(DOUGH_SHELF.x, DOUGH_SHELF.y - 48, this.doughMode.toUpperCase(),
          { fontFamily: "sans-serif", fontSize: "18px", color: "#6E2B8B" })
          .setOrigin(0.5).setDepth(150);
        this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 500, onComplete: () => txt.destroy() });
      }
    });

    attachSpawnDrag(
      doughShelfZone,
      () => this.doughMode === "dough" ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice",
      (token) => {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        const key = token.texture.key;
        if (!onBoard) return;

        if (key === "kitchen_ingredient_dough") {
          this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
          this.pie.lattice = false; this.clearToppings();
          this.pieGroup.setVisible(true);
          this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          this.pieJam.setVisible(false); this.pieTop.setVisible(false);
        } else if (key === "kitchen_ingredient_lattice" && this.pie.hasDough) {
          this.pie.lattice = true; this.pieTop.setTexture("pie_top_raw").setVisible(true);
        }
      }
    );

    // ===== 재료/토핑 공통 바구니 =====
    const makeIngredientBasket = (rect:{x:number;y:number;w:number;h:number}, texKey:string) => {
      const z = this.add.zone(rect.x, rect.y, rect.w, rect.h)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(100);
      this.input.setDraggable(z, true);

      attachSpawnDrag(z, () => texKey, (token) => {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        if (!onBoard) return;

        // 매직은 잠금 중이면 무시
        if (texKey === "kitchen_ingredient_magic" && this.magicLocked) return;

        if (texKey.startsWith("kitchen_ingredient_") && this.pie.hasDough) {
          const mapsTo = this.mapKitchenToJam(texKey);
          if (mapsTo) {
            this.pie.filling = mapsTo;
            this.pieJam.setTexture(mapsTo).setVisible(true);
          }
        } else if (texKey.startsWith("pie_ingredient_") && this.pie.cooked) {
          if (!this.pie.toppings.has(texKey)) {
            this.pie.toppings.add(texKey);
            const top = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, texKey).setDepth(23);
            this.pieGroup.add(top);
            this.toppingSprites.push(top);
          }
        }
      });
    };

    // 일반 재료(매직 제외)
    Object.entries(BASKETS)
      .filter(([k]) => k !== "magic")
      .forEach(([k, v]) => makeIngredientBasket(v, `kitchen_ingredient_${k}`));
    // 토핑
    Object.entries(TOPPING_ZONES).forEach(([k, v]) => makeIngredientBasket(v, `pie_ingredient_${k}`));

    // ===== 매직 전용: 바구니 & 열쇠 =====
    const magicBasketZone = this.add.zone(BASKETS.magic.x, BASKETS.magic.y, BASKETS.magic.w, BASKETS.magic.h)
      .setOrigin(0.5).setInteractive({ useHandCursor: false }).setDepth(100);

    const attachMagicBasket = () => {
      if ((magicBasketZone as any).__bound) return;
      (magicBasketZone as any).__bound = true;
      magicBasketZone.setInteractive({ useHandCursor: true });
      this.input.setDraggable(magicBasketZone, true);
      attachSpawnDrag(magicBasketZone, () => "kitchen_ingredient_magic", (token) => {
        const dx = token.x - BOARD_POS.x, dy = token.y - BOARD_POS.y;
        const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
        if (!onBoard || !this.pie.hasDough) return;
        const mapsTo = this.mapKitchenToJam("kitchen_ingredient_magic");
        if (mapsTo) { this.pie.filling = mapsTo; this.pieJam.setTexture(mapsTo).setVisible(true); }
      });
    };

    // 열쇠(항상 보임), 보스만 드래그 가능
    this.add.image(MAGIC_KEY.x, MAGIC_KEY.y, "kitchen_magic_key").setDepth(100).setVisible(true);
    const keyZone = this.add.zone(MAGIC_KEY.x, MAGIC_KEY.y, MAGIC_KEY.w, MAGIC_KEY.h)
      .setOrigin(0.5).setInteractive({ useHandCursor: IS_BOSS_STAGE }).setDepth(101);
    if (IS_BOSS_STAGE) {
      this.input.setDraggable(keyZone, true);
      attachSpawnDrag(keyZone, () => "kitchen_magic_key", (token) => {
        const lockRect = new Phaser.Geom.Rectangle(
          BASKETS.magic.x - BASKETS.magic.w/2, BASKETS.magic.y - BASKETS.magic.h/2,
          BASKETS.magic.w, BASKETS.magic.h
        );
        if (Phaser.Geom.Intersects.RectangleToRectangle(token.getBounds(), lockRect)) {
          this.magicLocked = false;
          this.magicLockImg.setVisible(false);
          attachMagicBasket();
          const t = this.add.text(BASKETS.magic.x, BASKETS.magic.y - 70, "UNLOCKED",
            { fontFamily: "sans-serif", fontSize: "20px", color: "#6E2B8B" })
            .setOrigin(0.5).setDepth(150);
          this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 700, onComplete: ()=>t.destroy() });
        }
      });
    }

    // ===== 오븐/소각 드롭존 =====
    const ovenZone = this.add.zone(OVEN_ZONE.x, OVEN_ZONE.y, OVEN_ZONE.w, OVEN_ZONE.h)
      .setOrigin(0.5).setRectangleDropZone(OVEN_ZONE.w, OVEN_ZONE.h).setDepth(5);
    const burnZone = this.add.zone(BURN_ZONE.x, BURN_ZONE.y, BURN_ZONE.w, BURN_ZONE.h)
      .setOrigin(0.5).setRectangleDropZone(BURN_ZONE.w, BURN_ZONE.h).setDepth(5);

    // 드롭 처리(오븐 중에는 스냅백/표시 금지)
    this.input.on("drop", (_p: any, g: any, dropZone: any) => {
      if (g !== this.pieGroup) return;

      if (dropZone === ovenZone && this.pie.hasDough) {
        this.activateOvenTimer(); // 숨김 + isBaking=true
        return;                   // 스냅백/표시 금지
      }

      if (dropZone === burnZone) {
        this.resetPie();
      }

      if (!this.isBaking) {
        this.pieGroup.setVisible(true).setPosition(BOARD_POS.x, BOARD_POS.y);
      }
    });

    // 드롭존 밖에서 놓았을 때 스냅백(베이킹 중에는 금지)
    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;
      if (!this.isBaking) {
        this.pieGroup.setVisible(true).setPosition(BOARD_POS.x, BOARD_POS.y);
      }
    });

    // TODO: Hall 씬 준비되면 화살표 활성화
    // const toHallArrow = this.add.image(84, 606, "kitchen_arrow").setDepth(1000).setInteractive({ useHandCursor: true });
    // toHallArrow.on("pointerup", () => this.scene.start("Hall"));
  }

  private mapKitchenToJam(key:string): string | null {
    const suffix = key.replace("kitchen_ingredient_", "");
    return `pie_jam_${suffix}`;
  }

  private clearToppings() {
    for (const s of this.toppingSprites) s.destroy();
    this.toppingSprites.length = 0;
    this.pie.toppings.clear();
  }

  private activateOvenTimer() {
    this.isBaking = true;               // 베이킹 시작
    this.pieGroup.setVisible(false);    // 굽는 동안 파이 비가시화
    this.input.setDraggable(this.pieGroup, false);

    const frames = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
    this.ovenTimer.setVisible(true).setTexture(frames[0]);

    let i = 0;
    const tick = () => {
      i++;
      if (i < frames.length) {
        this.ovenTimer.setTexture(frames[i]);
        this.time.delayedCall(1000, tick);
      } else {
        this.ovenTimer.setVisible(false);
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y).setVisible(true);
        this.input.setDraggable(this.pieGroup, true);
        this.isBaking = false;          // 베이킹 종료
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private resetPie() {
    this.pie.hasDough = false; this.pie.cooked = false;
    this.pie.filling = null; this.pie.lattice = false;
    this.clearToppings();
    this.pieBottom.setVisible(false); this.pieJam.setVisible(false); this.pieTop.setVisible(false);
  }
}
