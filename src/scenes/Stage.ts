import Phaser from "phaser";

type XY = { x: number; y: number };
type Zone = XY & { w: number; h: number };
type Board = XY & { r: number; snap?: number };

type BinItem = { key: string; x: number; y: number; mapsTo?: string; lockedBy?: string; };
type DoughSlot = {
  x: number; y: number;
  mode: "dough" | "lattice";
  cycleOnTap: boolean;
  label: { x: number; y: number; textDough: string; textLattice: string; fontSize: number; color: string };
  alternatives: { key: string; mapsTo: string }[];
};

type Layout = {
  hall: { entryX: number; entryY: number; standX: number; standY: number; deliverZone: Zone; };
  kitchen: {
    board: Board;
    ovenZone: Zone;
    burnZone: Zone;
    timer: { x: number; y: number; frames: string[] };
    bins: { doughSlot: DoughSlot; fillings: BinItem[]; toppings: BinItem[] };
    magic: { lock: Zone & { key: string }; key: XY & { key: string } };
  };
};

type Customer = {
  id: string;
  sprites: { standard: string; happy: string; angry: string };
  order: { filling: string; needsLattice: boolean; toppings: string[]; exactMatch: true; dialogue?: any };
};

type StageData = {
  id: number;
  name: string;
  bakeTimeSec: number;
  ui: { arrowToKitchen: XY; arrowToHall: XY; };
  layout: Layout;
  customers: Customer[];
  boss?: any;
};

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private dataJson!: StageData;
  private isKitchen = false;

  // UI
  private hallArrow!: Phaser.GameObjects.Image;
  private kitchenArrow!: Phaser.GameObjects.Image;
  private hallBg!: Phaser.GameObjects.Image;
  private kitchenBg!: Phaser.GameObjects.Image;

  // Board/pie state
  private board!: Board;
  private pie = {
    hasDough: false,
    cooked: false,
    filling: null as string | null,
    lattice: false,
    toppings: new Set<string>()
  };

  private customerIndex = 0;
  private goodCount = 0;
  private badCount = 0;

  preload() {
    // 데이터
    this.load.json("stage01", "assets/data/stage01.json");

    // 배경
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");

    // UI
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");

    // 파이 / 도마 / 타이머
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");

    // 재료
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);

    this.load.image("kitchen_ingredient_dough", "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle", "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key", "assets/images/kitchen_magic_key.png");
  }

  create() {
    this.dataJson = this.cache.json.get("stage01") as StageData;

    // 배경 추가
    this.hallBg = this.add.image(640, 360, "hall_background").setOrigin(0.5).setDepth(0);
    this.kitchenBg = this.add.image(640, 360, "kitchen_background").setOrigin(0.5).setDepth(0).setVisible(false);

    // 기본은 홀부터 시작
    this.isKitchen = false;

    // 화살표
    this.hallArrow = this.add.image(this.dataJson.ui.arrowToKitchen.x, this.dataJson.ui.arrowToKitchen.y, "hall_arrow")
      .setInteractive({ useHandCursor: true }).setDepth(50);
    this.kitchenArrow = this.add.image(this.dataJson.ui.arrowToHall.x, this.dataJson.ui.arrowToHall.y, "kitchen_arrow")
      .setInteractive({ useHandCursor: true }).setDepth(50).setVisible(false);

    this.hallArrow.on("pointerdown", () => this.toKitchen());
    this.kitchenArrow.on("pointerdown", () => this.toHall());

    // 도마
    this.board = this.dataJson.layout.kitchen.board;
    const boardImg = this.add.image(this.board.x, this.board.y, "pie_cuttingboard").setDepth(10);
    boardImg.setVisible(false);

    // 도우/격자 슬롯
    const ds = this.dataJson.layout.kitchen.bins.doughSlot;
    let doughMode: "dough" | "lattice" = ds.mode;
    const doughIcon = this.add.image(ds.x, ds.y, ds.alternatives[0].key)
      .setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);
    const modeLabel = this.add.text(ds.label.x, ds.label.y,
      ds.label.textDough,
      { fontFamily: "sans-serif", fontSize: `${ds.label.fontSize}px`, color: ds.label.color })
      .setOrigin(0.5).setDepth(31);

    doughIcon.on("pointerdown", () => {
      if (!ds.cycleOnTap) return;
      doughMode = doughMode === "dough" ? "lattice" : "dough";
      doughIcon.setTexture(doughMode === "dough" ? ds.alternatives[0].key : ds.alternatives[1].key);
      modeLabel.setText(doughMode === "dough" ? ds.label.textDough : ds.label.textLattice);
    });

    // 파이 레이어
    const pieBottom = this.add.image(this.board.x, this.board.y, "pie_bottom_raw").setVisible(false).setDepth(20);
    const pieJam = this.add.image(this.board.x, this.board.y, "pie_jam_apple").setVisible(false).setDepth(21);
    const pieTop = this.add.image(this.board.x, this.board.y, "pie_top_raw").setVisible(false).setDepth(22);
    const toppingLayer = this.add.layer().setDepth(23);

    // 오븐 타이머
    const timerPos = this.dataJson.layout.kitchen.timer;
    const timerFrames = timerPos.frames;
    const timerIcon = this.add.image(timerPos.x, timerPos.y, timerFrames[0]).setVisible(false).setDepth(90);

    // 드롭존
    const oven = this.dataJson.layout.kitchen.ovenZone;
    const burn = this.dataJson.layout.kitchen.burnZone;
    const ovenZone = this.add.zone(oven.x, oven.y, oven.w, oven.h).setRectangleDropZone(oven.w, oven.h);
    const burnZone = this.add.zone(burn.x, burn.y, burn.w, burn.h).setRectangleDropZone(burn.w, burn.h);
    ovenZone.setData("type", "oven");
    burnZone.setData("type", "burn");

    // 재료 아이콘 생성
    for (const f of this.dataJson.layout.kitchen.bins.fillings)
      this.add.image(f.x, f.y, f.key).setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);
    for (const t of this.dataJson.layout.kitchen.bins.toppings)
      this.add.image(t.x, t.y, t.key).setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);

    // 드래그 로직
    this.input.on("dragstart", (_p, g: any) => g.setDepth(50));
    this.input.on("drag", (_p, g: any, x: number, y: number) => g.setPosition(x, y));

    this.input.on("dragend", (_p, g: Phaser.GameObjects.Image) => {
      const dx = g.x - this.board.x, dy = g.y - this.board.y;
      const onBoard = (dx * dx + dy * dy) <= (this.board.r * this.board.r);
      const key = g.texture.key;

      if (onBoard) {
        // 도우 / 격자
        if (key === ds.alternatives[0].key) {
          this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
          this.pie.lattice = false; this.pie.toppings.clear();
          pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          pieJam.setVisible(false); pieTop.setVisible(false); toppingLayer.removeAll(true);
        } else if (key === ds.alternatives[1].key) {
          if (this.pie.hasDough) { this.pie.lattice = true; pieTop.setTexture("pie_top_raw").setVisible(true); }
        }
        // 속
        if (key.startsWith("kitchen_ingredient_") && key !== ds.alternatives[0].key && key !== ds.alternatives[1].key) {
          if (this.pie.hasDough) {
            const mapsTo = this.mapKitchenToJam(key);
            if (mapsTo) { this.pie.filling = mapsTo; pieJam.setTexture(mapsTo).setVisible(true); }
          }
        }
        // 토핑
        if (key.startsWith("pie_ingredient_") && this.pie.cooked) {
          if (!this.pie.toppings.has(key)) {
            this.pie.toppings.add(key);
            const top = this.add.image(this.board.x, this.board.y, key).setDepth(23);
            toppingLayer.add(top);
          }
        }
      }
      g.setPosition((g as any).data?.origX ?? g.x, (g as any).data?.origY ?? g.y);
    });

    // 오븐/소각
    this.input.on("drop", (_p, g: any, z: any) => {
      const type = z.getData("type");
      if (type === "oven" && this.pie.hasDough) {
        timerIcon.setVisible(true).setTexture(timerFrames[0]);
        let idx = 0;
        const tick = () => {
          idx++;
          if (idx < timerFrames.length) {
            timerIcon.setTexture(timerFrames[idx]);
            this.time.delayedCall(1000, tick);
          } else {
            timerIcon.setVisible(false);
            this.pie.cooked = true;
            pieBottom.setTexture("pie_bottom_cooked");
            if (this.pie.lattice) pieTop.setTexture("pie_top_cooked");
          }
        };
        this.time.delayedCall(1000, tick);
      } else if (type === "burn") this.resetPie(pieBottom, pieJam, pieTop, toppingLayer);
    });

    // 초기 표시
    this.setKitchenVisible(false);
  }

  private mapKitchenToJam(key: string): string | null {
    const suffix = key.replace("kitchen_ingredient_", "");
    return `pie_jam_${suffix}`;
  }

  private resetPie(bottom: Phaser.GameObjects.Image, jam: Phaser.GameObjects.Image, top: Phaser.GameObjects.Image, layer: Phaser.GameObjects.Layer) {
    this.pie.hasDough = false; this.pie.cooked = false; this.pie.filling = null; this.pie.lattice = false; this.pie.toppings.clear();
    bottom.setVisible(false); jam.setVisible(false); top.setVisible(false); layer.removeAll(true);
  }

  private toKitchen() {
    if (this.isKitchen) return;
    this.isKitchen = true;
    this.hallBg.setVisible(false);
    this.kitchenBg.setVisible(true);
    this.hallArrow.setVisible(false);
    this.kitchenArrow.setVisible(true);
  }

  private toHall() {
    if (!this.isKitchen) return;
    this.isKitchen = false;
    this.hallBg.setVisible(true);
    this.kitchenBg.setVisible(false);
    this.hallArrow.setVisible(true);
    this.kitchenArrow.setVisible(false);
  }

  private setKitchenVisible(v: boolean) {
    // 도마/재료 보이기 제어
    this.children.each(ch => {
      if (ch instanceof Phaser.GameObjects.Image || ch instanceof Phaser.GameObjects.Text || ch instanceof Phaser.GameObjects.Layer) {
        if (ch.depth >= 10 && ch.depth <= 90) ch.setVisible(v);
      }
    });
  }
}
