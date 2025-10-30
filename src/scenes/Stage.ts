import Phaser from "phaser";

type PieState = {
  hasDough: boolean;
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
};

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private stageData: any;
  private K!: any;

  private board!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;

  private magicLocked = true;
  private magicLockImg?: Phaser.GameObjects.Image;

  // 내부 상태
  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private doughMode: "dough"|"lattice" = "dough";

  preload() {
    const cur = this.registry.get("currentStage") || 1;
    this.load.json("stageData", `assets/data/stage0${cur}.json`);

    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");

    // 타이머 프레임은 json에서 texture key로 받음
    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");

    // 파이 레이어
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

    // 도우/재료
    this.load.image("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);
    }

    this.load.image("pie_ingredient_cherry",      "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle",    "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  create() {
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    this.stageData = this.cache.json.get("stageData");
    this.K = this.stageData.layout.kitchen;

    // 배경
    this.add.image(640, 360, "kitchen_background").setDepth(-1000);

    // 도마
    this.board = this.add.image(this.K.board.x, this.K.board.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너
    this.pieGroup = this.add.container(this.K.board.x, this.K.board.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(0, -90, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(0, -90, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(0, -90, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    this.input.setDraggable(this.pieGroup, true);

    // 타이머
    const t = this.stageData.layout.kitchen.timer;
    this.ovenTimer = this.add.image(t.x, t.y, t.frames[0]).setVisible(false).setDepth(30);

    // 매직 락/키
    if (this.stageData.magicUnlocked) {
      this.magicLocked = false;
    } else {
      this.magicLocked = true;
      const m = this.K.magic?.lock;
      if (m) this.magicLockImg = this.add.image(m.x, m.y, m.key).setDepth(34).setVisible(true);
    }

    // 도우 슬롯
    this.makeDoughSlot(this.K.bins.doughSlot);

    // 필링/토핑 바구니
    (this.K.bins.fillings || []).forEach((f: any) => this.makeBasket(f, "filling"));
    (this.K.bins.toppings || []).forEach((f: any) => this.makeBasket(f, "topping"));

    // 홀 이동 화살표
    const UI = this.stageData.ui;
    this.add.image(UI.arrowToHall.x, UI.arrowToHall.y, "kitchen_arrow")
      .setFlipX(true)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        this.savePieState();
        this.registry.set("cameFromKitchen", true);
        this.scene.start("Hall");
      });

    // 파이 드래그 종료 → 오븐/소각 판정
    const oven = new Phaser.Geom.Rectangle(this.K.ovenZone.x - this.K.ovenZone.w/2, this.K.ovenZone.y - this.K.ovenZone.h/2, this.K.ovenZone.w, this.K.ovenZone.h);
    const burn = new Phaser.Geom.Rectangle(this.K.burnZone.x - this.K.burnZone.w/2, this.K.burnZone.y - this.K.burnZone.h/2, this.K.burnZone.w, this.K.burnZone.h);

    this.input.on("dragend", (_p:any, g:any) => {
      if (g !== this.pieGroup) return;
      const bounds = this.pieGroup.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, oven) && this.pie.hasDough) {
        this.startBakeTimer();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, burn)) {
        this.resetPie();
      }
      this.pieGroup.setPosition(this.K.board.x, this.K.board.y);
    });
  }

  // 도우 슬롯(탭=도우/격자 모드 토글, 드래그=해당 모드 토큰 꺼내기)
  private makeDoughSlot(cfg: any) {
    const zone = this.add.zone(cfg.x, cfg.y, 140, 100).setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(100);
    let dragged = false;

    const labelText = this.add.text(cfg.label.x, cfg.label.y, "DOUGH", {
      fontFamily:"sans-serif", fontSize: cfg.label.fontSize ?? 20, color: cfg.label.color ?? "#6E2B8B"
    }).setOrigin(0.5).setDepth(101);

    const spawn = (pointer: Phaser.Input.Pointer) => {
      const key = (this.doughMode === "dough") ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice";
      const token = this.add.image(pointer.worldX, pointer.worldY, key).setDepth(101);
      const move = (p: Phaser.Input.Pointer) => token.setPosition(p.worldX, p.worldY);
      this.input.on("pointermove", move);

      this.input.once("pointerup", () => {
        this.input.off("pointermove", move);
        // 보드 안인가?
        const dx = token.x - this.K.board.x, dy = token.y - this.K.board.y;
        const inBoard = (dx*dx + dy*dy) <= (this.K.board.r * this.K.board.r);
        if (inBoard) {
          if (key === "kitchen_ingredient_dough") {
            this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
            this.pie.lattice = false; this.pie.toppings.clear();
            this.pieGroup.setVisible(true);
            this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
            this.pieJam.setVisible(false);
            this.pieTop.setVisible(false);
          } else {
            if (this.pie.hasDough) {
              this.pie.lattice = true;
              this.pieTop.setTexture(this.pie.cooked ? "pie_top_cooked" : "pie_top_raw").setVisible(true);
            }
          }
        }
        // 원위치 트윈 후 제거
        this.tweens.add({ targets: token, x: cfg.x, y: cfg.y, duration: 180, onComplete: () => token.destroy() });
      });
    };

    zone.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragged = true; spawn(pointer); });
    zone.on("pointerup", () => {
      if (!dragged && cfg.cycleOnTap) {
        this.doughMode = (this.doughMode === "dough") ? "lattice" : "dough";
        labelText.setText(this.doughMode === "dough" ? (cfg.label.textDough ?? "DOUGH") : (cfg.label.textLattice ?? "LATTICE"));
      }
      dragged = false;
    });
  }

  private makeBasket(cfg: any, kind: "filling" | "topping") {
    const zone = this.add.zone(cfg.x, cfg.y, cfg.w ?? 120, cfg.h ?? 110)
      .setOrigin(0.5).setInteractive({ draggable: true, useHandCursor: true }).setDepth(100);

    // magic 잠금
    if (cfg.key === "kitchen_ingredient_magic" && this.magicLocked) {
      // 락 이미지는 배경에 이미 그려뒀음 (Hall의 안내와 일관)
    }

    zone.on("dragstart", (pointer: Phaser.Input.Pointer) => {
      // 잠금 체크
      if (cfg.key === "kitchen_ingredient_magic" && this.magicLocked) return;

      const token = this.add.image(pointer.worldX, pointer.worldY, cfg.key).setDepth(101);
      const move = (p: Phaser.Input.Pointer) => token.setPosition(p.worldX, p.worldY);
      this.input.on("pointermove", move);

      this.input.once("pointerup", () => {
        this.input.off("pointermove", move);

        const dx = token.x - this.K.board.x, dy = token.y - this.K.board.y;
        const inBoard = (dx*dx + dy*dy) <= (this.K.board.r * this.K.board.r);

        if (inBoard) {
          if (kind === "filling" && this.pie.hasDough) {
            const mapTo = cfg.mapsTo; // "pie_jam_xxx"
            if (mapTo) {
              this.pie.filling = mapTo;
              this.pieJam.setTexture(mapTo).setVisible(true);
            }
          } else if (kind === "topping" && this.pie.cooked) {
            const key = cfg.key; // "pie_ingredient_xxx"
            if (!this.pie.toppings.has(key)) {
              this.pie.toppings.add(key);
              const top = this.add.image(0, -90, key).setDepth(23);
              this.pieGroup.add(top);
            }
          }
        }

        this.tweens.add({ targets: token, x: cfg.x, y: cfg.y, duration: 180, onComplete: () => token.destroy() });
      });
    });
  }

  private startBakeTimer() {
    // 파이 숨김
    this.pieGroup.setVisible(false);
    this.input.setDraggable(this.pieGroup, false);

    const frames: string[] = this.K.timer.frames;
    let i = 0;
    this.ovenTimer.setTexture(frames[0]).setVisible(true);

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
        this.pieGroup.setPosition(this.K.board.x, this.K.board.y).setVisible(true);
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

  private savePieState() {
    const s: PieState = {
      hasDough: this.pie.hasDough,
      cooked: this.pie.cooked,
      filling: this.pie.filling,
      lattice: this.pie.lattice,
      toppings: [...this.pie.toppings]
    };
    this.registry.set("pieState", s);
  }
}
