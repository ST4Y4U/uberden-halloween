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
  cherry:      { x: 90,  y: 477, w: 95, h: 93 },
  sugarpowder: { x: 240, y: 477, w: 95, h: 93 },
  sprinkle:    { x: 390, y: 477, w: 95, h: 93 }
};

const MAGIC_KEY = { x: 1240, y: 505, w: 57, h: 21 };
const PIE_OFFSET = { x: 0, y: -90 };

// ===== 스테이지 플래그(보스 판정) =====
// 레지스트리(this.registry.set("stage", n))를 쓰고 있으면 거기서 읽고, 없으면 1로.
const getStageFromRegistry = (): number => {
  try {
    // 씬 생성 전이라 접근이 어렵다면 window에 주입해 둔 값을 우선 사용
    const w: any = window as any;
    if (w && typeof w.STAGE === "number") return w.STAGE;
  } catch {}
  return 1;
};
const STAGE = getStageFromRegistry();
const IS_BOSS_STAGE = STAGE >= 6; // 6~7 스테이지

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private doughMode: "dough" | "lattice" = "dough";
  private magicLocked = true; // 시작은 잠금

  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;
  private magicLockImg!: Phaser.GameObjects.Image;

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

    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");

    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  create() {
    // 입력 성능/충돌 설정
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    // 배경은 절대 뒤
    this.add.image(640, 360, "kitchen_background").setOrigin(0.5).setDepth(-1000);

    // 도마는 항상 보임
    this.boardImg = this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10).setVisible(true);

    // 파이 컨테이너
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 컨테이너도 드래그 가능하도록 히트영역 지정
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(
      new Phaser.Geom.Rectangle(-160, -110, 320, 220),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.setDraggable(this.pieGroup, true);

    // 파이 드래그 중 실제 위치 갱신
    this.input.on("drag", (_pointer, g: any, dragX: number, dragY: number) => {
      if (g === this.pieGroup) this.pieGroup.setPosition(dragX, dragY);
    });

    // 오븐 타이머/락
    this.ovenTimer = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1").setVisible(false).setDepth(20);
    this.magicLockImg = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(34).setVisible(true);

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

    let doughDragged = false;
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
          this.pie.lattice = false; this.pie.toppings.clear();
          this.pieGroup.setVisible(true);
          this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          this.pieJam.setVisible(false); this.pieTop.setVisible(false);
        } else if (key === "kitchen_ingredient_lattice" && this.pie.hasDough) {
          this.pie.lattice = true; this.pieTop.setTexture("pie_top_raw").setVisible(true);
        }
      }
    );
    doughShelfZone.on("dragstart", ()=> { doughDragged = true; });
    doughShelfZone.on("pointerup", () => {
      if (!doughDragged) this.doughMode = (this.doughMode === "dough") ? "lattice" : "dough";
      doughDragged = false;
    });

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
    // 바구니 Zone(해금 전엔 커서/드래그 비활성)
    const magicBasketZone = this.add.zone(BASKETS.magic.x, BASKETS.magic.y, BASKETS.magic.w, BASKETS.magic.h)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: false })
      .setDepth(100);

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
        if (mapsTo) {
          this.pie.filling = mapsTo;
          this.pieJam.setTexture(mapsTo).setVisible(true);
        }
      });
    };

    // 열쇠는 항상 보이되, 보스 스테이지만 드래그 가능
    this.add.image(MAGIC_KEY.x, MAGIC_KEY.y, "kitchen_magic_key").setDepth(100).setVisible(true);
    const keyZone = this.add.zone(MAGIC_KEY.x, MAGIC_KEY.y, MAGIC_KEY.w, MAGIC_KEY.h)
      .setOrigin(0.5).setInteractive({ useHandCursor: IS_BOSS_STAGE }).setDepth(101);

    if (IS_BOSS_STAGE) {
      this.input.setDraggable(keyZone, true);
      attachSpawnDrag(keyZone, () => "kitchen_magic_key", (token) => {
        // 자물쇠와 겹치면 해금
        const lockRect = new Phaser.Geom.Rectangle(
          BASKETS.magic.x - BASKETS.magic.w/2, BASKETS.magic.y - BASKETS.magic.h/2,
          BASKETS.magic.w, BASKETS.magic.h
        );
        if (Phaser.Geom.Intersects.RectangleToRectangle(token.getBounds(), lockRect)) {
          this.magicLocked = false;
          this.magicLockImg.setVisible(false);
          attachMagicBasket(); // 매직 바구니 활성화

          // 피드백
          const t = this.add.text(BASKETS.magic.x, BASKETS.magic.y - 70, "UNLOCKED", {
            fontFamily: "sans-serif", fontSize: "20px", color: "#6E2B8B"
          }).setOrigin(0.5).setDepth(150);
          this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 700, onComplete: ()=>t.destroy() });
        }
      });
    }

    // ===== 파이 드래그 종료: 오븐/소각 판정 & 스냅백 =====
    const ovenRect = new Phaser.Geom.Rectangle(
      OVEN_ZONE.x-OVEN_ZONE.w/2, OVEN_ZONE.y-OVEN_ZONE.h/2, OVEN_ZONE.w, OVEN_ZONE.h
    );
    const burnRect = new Phaser.Geom.Rectangle(
      BURN_ZONE.x-BURN_ZONE.w/2, BURN_ZONE.y-BURN_ZONE.h/2, BURN_ZONE.w, BURN_ZONE.h
    );

    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;
      const pieRect = this.pieGroup.getBounds();

      if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, ovenRect) && this.pie.hasDough) {
        this.activateOvenTimer(); // 여기서만 파이 숨김
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, burnRect)) {
        this.resetPie();          // 소각에만 리셋
      }
      // 항상 도마로 스냅백
      this.pieGroup.setVisible(true).setPosition(BOARD_POS.x, BOARD_POS.y);
    });
  }

  private mapKitchenToJam(key:string): string | null {
    const suffix = key.replace("kitchen_ingredient_", "");
    return `pie_jam_${suffix}`;
  }

  private activateOvenTimer() {
    this.pieGroup.setVisible(false);
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
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private resetPie() {
    this.pie.hasDough = false; this.pie.cooked = false;
    this.pie.filling = null; this.pie.lattice = false; this.pie.toppings.clear();
    this.pieBottom.setVisible(false); this.pieJam.setVisible(false); this.pieTop.setVisible(false);
  }
}
