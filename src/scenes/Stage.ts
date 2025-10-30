// src/scenes/Stage.ts
import Phaser from "phaser";
import { getGameState, setGameState, setPieState } from "../data/state.ts";

const BOARD_POS   = { x: 720, y: 625 };
const BOARD_HIT_R = 160;
const PIE_OFFSET  = { x: 0, y: -90 };

const OVEN_ZONE = { x: 1040, y: 170, w: 356, h: 246 };
const BURN_ZONE = { x: 1040, y: 440, w: 285, h:  60 };
const TIMER_POS = { x: 1040, y: 200 };

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
  cherry:      { x: 240, y: 620, w: 95, h: 93 },
  sprinkle:    { x: 480, y: 620, w: 95, h: 93 },
  sugarpowder: { x: 720, y: 620, w: 95, h: 93 }
};

export default class Stage extends Phaser.Scene {
  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;
  private doughMode: "dough" | "lattice" = "dough";
  private magicLocked = true;

  constructor(){ super("Stage"); }

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
      this.load.image(`pie_jam_${f}`,            `assets/images/pie_jam_${f}.png`);
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

    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");
  }

  create() {
    // 배경 맨뒤
    this.add.image(640, 360, "kitchen_background").setDepth(-1000);

    // 도마(항상 보임)
    this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 파이 드래그(오븐/소각 판정용)
    this.input.setDraggable(this.pieGroup, true);

    // 오븐 타이머
    this.ovenTimer = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1")
      .setVisible(false).setDepth(25);

    // 매직 잠금 (기본 잠김, 7스테이지에서만 열쇠 사용 가능)
    const stageId = getGameState().stageId ?? 1;
    this.magicLocked = true;
    const magicLock = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(34).setVisible(true);
    const magicKey  = this.add.image(1220, 660, "kitchen_magic_key").setDepth(35)
      .setVisible(stageId === 7) // 최종 보스에서만 열쇠 표시
      .setInteractive({ draggable: true, useHandCursor: (stageId === 7) });

    if (stageId === 7) {
      // 열쇠 드래그하여 잠금 해제
      this.input.setDraggable(magicKey, true);
      magicKey.on("drag", (_p:any, x:number, y:number) => magicKey.setPosition(x, y));
      magicKey.on("dragend", () => {
        const r = new Phaser.Geom.Rectangle(BASKETS.magic.x - 36, BASKETS.magic.y -36, 72, 72);
        if (Phaser.Geom.Rectangle.Contains(r, magicKey.x, magicKey.y)) {
          this.magicLocked = false;
          magicLock.setVisible(false);
          this.tweens.add({ targets: magicKey, alpha: 0, duration: 200, onComplete: () => magicKey.destroy() });
        } else {
          this.tweens.add({ targets: magicKey, x: 1220, y: 660, duration: 180 });
        }
      });
    }

    // 재료/토핑 소환 유틸
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      key: string,
      onDrop: (token: Phaser.GameObjects.Image) => void
    ) => {
      let token: Phaser.GameObjects.Image | null = null;

      zone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        token = this.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(101).setInteractive();
      });

      zone.on("drag", (_p:any, x:number, y:number) => {
        if (token) token.setPosition(x, y);
      });

      zone.on("dragend", () => {
        if (token) {
          onDrop(token);
          this.tweens.add({ targets: token, x: zone.x, y: zone.y, duration: 160, onComplete: () => token?.destroy() });
          token = null;
        }
      });
    };

    const onBoard = (x:number, y:number) => {
      const dx = x - BOARD_POS.x, dy = y - BOARD_POS.y;
      return (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
    };

    // 도우/격자 선반
    const doughShelf = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(100);

    let shelfDragged = false;
    attachSpawnDrag(doughShelf, "kitchen_ingredient_dough", (token) => {
      shelfDragged = true;
      if (onBoard(token.x, token.y)) {
        // 도우 깔기
        this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
        this.pie.lattice = false; this.pie.toppings.clear();
        this.pieGroup.setVisible(true);
        this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
        this.pieJam.setVisible(false);
        this.pieTop.setVisible(false);
      }
    });

    doughShelf.on("pointerup", () => {
      // 탭으로 모드 전환: 도우 ↔ 격자
      if (!shelfDragged) {
        this.doughMode = this.doughMode === "dough" ? "lattice" : "dough";
        const txt = this.add.text(DOUGH_SHELF.x, DOUGH_SHELF.y - 48,
          (this.doughMode === "dough") ? "DOUGH" : "LATTICE",
          { fontFamily:"sans-serif", fontSize:"18px", color:"#6E2B8B" }
        ).setOrigin(0.5).setDepth(101);
        this.tweens.add({ targets: txt, y: txt.y - 24, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
      }
      shelfDragged = false;
    });

    // 격자 소환: 동일 선반에서 모드가 lattice일 때만
    doughShelf.on("dragstart", (p: Phaser.Input.Pointer) => {
      if (this.doughMode === "lattice") {
        // lattice 스폰으로 대체
        const token = this.add.image(p.worldX, p.worldY, "kitchen_ingredient_lattice").setDepth(101).setInteractive();
        const follow = (pp: Phaser.Input.Pointer) => token.setPosition(pp.worldX, pp.worldY);
        this.input.on("pointermove", follow);
        this.input.once("pointerup", () => {
          if (onBoard(token.x, token.y) && this.pie.hasDough) {
            this.pie.lattice = true;
            this.pieTop.setTexture("pie_top_raw").setVisible(true);
          }
          this.tweens.add({ targets: token, x: doughShelf.x, y: doughShelf.y, duration: 160, onComplete: () => token.destroy() });
          this.input.off("pointermove", follow);
        });
      }
    });

    // 필링/토핑 바구니
    const makeBasket = (rect:{x:number;y:number;w:number;h:number}, key:string, drop:(token:Phaser.GameObjects.Image)=>void) => {
      const z = this.add.zone(rect.x, rect.y, rect.w, rect.h)
        .setOrigin(0.5).setInteractive({ draggable:true, useHandCursor:true }).setDepth(100);
      attachSpawnDrag(z, key, drop);
    };

    const dropFilling = (token: Phaser.GameObjects.Image) => {
      if (!onBoard(token.x, token.y) || !this.pie.hasDough) return;
      const suffix = token.texture.key.replace("kitchen_ingredient_","");
      if (suffix === "magic" && this.magicLocked) return; // 잠김이면 무시
      const jam = `pie_jam_${suffix}`;
      this.pie.filling = jam;
      this.pieJam.setTexture(jam).setVisible(true);
    };

    const dropTopping = (token: Phaser.GameObjects.Image) => {
      if (!onBoard(token.x, token.y) || !this.pie.cooked) return;
      const k = token.texture.key;
      if (!this.pie.toppings.has(k)) {
        this.pie.toppings.add(k);
        const top = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, k).setDepth(23);
        this.pieGroup.add(top);
      }
    };

    // 필링 바구니
    makeBasket(BASKETS.apple,     "kitchen_ingredient_apple",     dropFilling);
    makeBasket(BASKETS.pumpkin,   "kitchen_ingredient_pumpkin",   dropFilling);
    makeBasket(BASKETS.raspberry, "kitchen_ingredient_raspberry", dropFilling);
    makeBasket(BASKETS.blueberry, "kitchen_ingredient_blueberry", dropFilling);
    makeBasket(BASKETS.strawberry,"kitchen_ingredient_strawberry",dropFilling);
    makeBasket(BASKETS.pecan,     "kitchen_ingredient_pecan",     dropFilling);
    makeBasket(BASKETS.magic,     "kitchen_ingredient_magic",     dropFilling);

    // 토핑 바구니
    makeBasket(TOPPING_ZONES.cherry,      "pie_ingredient_cherry",      dropTopping);
    makeBasket(TOPPING_ZONES.sprinkle,    "pie_ingredient_sprinkle",    dropTopping);
    makeBasket(TOPPING_ZONES.sugarpowder, "pie_ingredient_sugarpowder", dropTopping);

    // 오븐/소각 판정
    const ovenRect = new Phaser.Geom.Rectangle(OVEN_ZONE.x-OVEN_ZONE.w/2, OVEN_ZONE.y-OVEN_ZONE.h/2, OVEN_ZONE.w, OVEN_ZONE.h);
    const burnRect = new Phaser.Geom.Rectangle(BURN_ZONE.x-BURN_ZONE.w/2, BURN_ZONE.y-BURN_ZONE.h/2, BURN_ZONE.w, BURN_ZONE.h);

    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;
      const r = this.pieGroup.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, ovenRect) && this.pie.hasDough) {
        this.bakePie();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(r, burnRect)) {
        this.resetPie();
      }
      this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
    });

    // 홀로 이동(좌하단)
    this.add.image(60, 640, "kitchen_arrow").setDepth(30).setInteractive({useHandCursor:true})
      .on("pointerup", () => {
        // 상태 저장 후 Hall로
        const state = {
          hasDough: this.pie.hasDough,
          cooked: this.pie.cooked,
          filling: this.pie.filling,
          lattice: this.pie.lattice,
          toppings: Array.from(this.pie.toppings)
        };
        setPieState(this.pie.hasDough ? state : null, true);
        this.scene.start("Hall");
      });
  }

  private bakePie() {
    // 오븐 동안 파이 숨김
    this.pieGroup.setVisible(false);
    // 타이머 4프레임 4초
    const frames = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
    this.ovenTimer.setVisible(true).setTexture(frames[0]);
    let i = 1;
    const tick = () => {
      if (i < frames.length) {
        this.ovenTimer.setTexture(frames[i++]);
        this.time.delayedCall(1000, tick);
      } else {
        this.ovenTimer.setVisible(false);
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y).setVisible(true);
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private resetPie() {
    this.pie.hasDough = false; this.pie.cooked = false;
    this.pie.filling = null; this.pie.lattice = false; this.pie.toppings.clear();
    this.pieBottom.setVisible(false); this.pieJam.setVisible(false); this.pieTop.setVisible(false);
    this.pieGroup.setVisible(false);
  }
}
