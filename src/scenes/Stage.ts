// src/scenes/Stage.ts
import Phaser from "phaser";

// 좌표 정의
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
  cherry:      { x: 90, y: 477, w: 95, h: 93 },
  sugarpowder: { x: 240, y: 477, w: 95, h: 93 },
  sprinkle:    { x: 390, y: 477, w: 95, h: 93 }
};

const MAGIC_KEY = { x: 1240, y: 505, w: 57, h: 21 };
const PIE_OFFSET = { x: 0, y: -90 };

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private isKitchen = false;
  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private doughMode: "dough" | "lattice" = "dough";
  private magicLocked = true;

  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;
  private hallPieGroup?: Phaser.GameObjects.Container;
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
    this.load.image("kitchen_magic_key", "assets/images/kitchen_magic_key.png");
  }

  create() {
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    this.add.image(640, 360, "kitchen_background").setDepth(-10);
    this.boardImg = this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10).setVisible(true);

    // 파이 컨테이너
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    this.input.setDraggable(this.pieGroup, true);

    this.ovenTimer = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1").setVisible(false).setDepth(20);
    this.magicLockImg = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(34).setVisible(true);

    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: () => string,
      onDrop: (token: Phaser.GameObjects.Image) => void
    ) => {
      let token: Phaser.GameObjects.Image | null = null;
      let dragging = false;

      const moveWithPointer = (p: Phaser.Input.Pointer) => { if (token) token.setPosition(p.worldX, p.worldY); };

      zone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
        dragging = true;
        const key = getKey();
        if (!key) return;
        token = zone.scene.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(101)
          .setInteractive({ useHandCursor: true })
          .setData("homeX", zone.x)
          .setData("homeY", zone.y);
        zone.scene.input.on("pointermove", moveWithPointer);
      });

      zone.on("drag", (pointer: Phaser.Input.Pointer) => moveWithPointer(pointer));

      zone.on("dragend", () => {
        if (token) {
          onDrop(token);
          const homeX = token.getData("homeX"), homeY = token.getData("homeY");
          zone.scene.tweens.add({
            targets: token,
            x: homeX, y: homeY,
            duration: 180,
            onComplete: () => { token?.destroy(); token = null; }
          });
        }
        dragging = false;
        zone.scene.input.off("pointermove", moveWithPointer);
      });

      return { wasDragged: () => dragging };
    };

    const doughShelfZone = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(100);

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
            this.pieGroup.setVisible(true);
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
      }
    });

    const makeIngredientBasket = (rect:{x:number;y:number;w:number;h:number}, texKey:string) => {
      const z = this.add.zone(rect.x, rect.y, rect.w, rect.h)
        .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(100);
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

    makeIngredientBasket(BASKETS.apple, "kitchen_ingredient_apple");
    makeIngredientBasket(BASKETS.pumpkin, "kitchen_ingredient_pumpkin");
    makeIngredientBasket(TOPPING_ZONES.cherry, "pie_ingredient_cherry");
    makeIngredientBasket(TOPPING_ZONES.sprinkle, "pie_ingredient_sprinkle");
    makeIngredientBasket(TOPPING_ZONES.sugarpowder, "pie_ingredient_sugarpowder");

    const ovenRect = new Phaser.Geom.Rectangle(OVEN_ZONE.x-OVEN_ZONE.w/2, OVEN_ZONE.y-OVEN_ZONE.h/2, OVEN_ZONE.w, OVEN_ZONE.h);
    const burnRect = new Phaser.Geom.Rectangle(BURN_ZONE.x-BURN_ZONE.w/2, BURN_ZONE.y-BURN_ZONE.h/2, BURN_ZONE.w, BURN_ZONE.h);

    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;
      const pieRect = this.pieGroup.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, ovenRect) && this.pie.hasDough) {
        this.activateOvenTimer();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, burnRect)) {
        this.resetPie();
      }
      this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
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
