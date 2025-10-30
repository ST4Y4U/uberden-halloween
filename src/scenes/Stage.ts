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
  hall: { entryX: number; entryY: number; standX: number; standY: number; deliverZone: Zone; counterY: number };
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
  order: { filling: string; needsLattice: boolean; toppings: string[]; exactMatch: true; };
};

type StageData = {
  id: number;
  name: string;
  bakeTimeSec: number;
  ui: { arrowToKitchen: XY; arrowToHall: XY; };
  layout: Layout;
  customers: Customer[];
};

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private dataJson!: StageData;
  private isKitchen = false;

  private hallBg!: Phaser.GameObjects.Image;
  private kitchenBg!: Phaser.GameObjects.Image;

  private hallArrow!: Phaser.GameObjects.Image;
  private kitchenArrow!: Phaser.GameObjects.Image;

  private customer!: Phaser.GameObjects.Image;
  private hallCounter!: Phaser.GameObjects.Image;
  private textbox!: Phaser.GameObjects.Image;

  private ovenTimer!: Phaser.GameObjects.Image;
  private timerFrames: string[] = [];

  private pie = {
    hasDough: false,
    cooked: false,
    filling: null as string | null,
    lattice: false,
    toppings: new Set<string>()
  };

  preload() {
    this.load.json("stage01", "assets/data/stage01.json");

    // 배경
    this.load.image("hall_background", "assets/images/hall_background.webp");
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");

    // 화살표
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");

    // 오브젝트
    this.load.image("hall_counter", "assets/images/hall_counter.png");
    this.load.image("hall_textbox", "assets/images/hall_textbox.png");
    this.load.image("hall_textbox_arrow", "assets/images/hall_textbox_arrow.png");

    // 파이 관련
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

    const fillings = ["pumpkin", "raspberry", "blueberry", "strawberry", "pecan", "apple", "magic"];
    for (const f of fillings) {
      this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);
    }

    this.load.image("kitchen_ingredient_dough", "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");
    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle", "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    // 오븐 타이머
    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");

    // 손님
    this.load.image("client_basic_standard", "assets/images/client_basic_standard.png");
    this.load.image("client_basic_happy", "assets/images/client_basic_happy.png");
    this.load.image("client_basic_angry", "assets/images/client_basic_angry.png");
  }

  create() {
    this.dataJson = this.cache.json.get("stage01") as StageData;

    // 배경
    this.hallBg = this.add.image(640, 360, "hall_background")
      .setOrigin(0.5)
      .setDisplaySize(1280, 720)
      .setDepth(-10);
    this.kitchenBg = this.add.image(640, 360, "kitchen_background")
      .setOrigin(0.5)
      .setDisplaySize(1280, 720)
      .setDepth(-10)
      .setVisible(false);

    // 홀 기본 구성
    this.customer = this.add.image(640, 360, "client_basic_standard").setDepth(10);
    this.hallCounter = this.add.image(640, 600, "hall_counter").setDepth(15);
    this.textbox = this.add.image(640, 150, "hall_textbox").setDepth(20);

    // 화살표
    this.hallArrow = this.add.image(this.dataJson.ui.arrowToKitchen.x, this.dataJson.ui.arrowToKitchen.y, "hall_arrow")
      .setInteractive({ useHandCursor: true }).setDepth(30);
    this.kitchenArrow = this.add.image(this.dataJson.ui.arrowToHall.x, this.dataJson.ui.arrowToHall.y, "kitchen_arrow")
      .setInteractive({ useHandCursor: true }).setDepth(30).setVisible(false);

    this.hallArrow.on("pointerdown", () => this.toKitchen());
    this.kitchenArrow.on("pointerdown", () => this.toHall());

    // 주방 파트
    this.ovenTimer = this.add.image(1050, 160, "kitchen_oven_timer_1").setVisible(false).setDepth(20);
    this.timerFrames = ["kitchen_oven_timer_1", "kitchen_oven_timer_2", "kitchen_oven_timer_3", "kitchen_oven_timer_4"];

    // 주방 재료 / 도마 / 파이
    const boardX = 640, boardY = 480;
    const board = this.add.image(boardX, boardY, "pie_cuttingboard").setDepth(10).setVisible(false);
    const pieBottom = this.add.image(boardX, boardY, "pie_bottom_raw").setVisible(false).setDepth(20);
    const pieJam = this.add.image(boardX, boardY, "pie_jam_apple").setVisible(false).setDepth(21);
    const pieTop = this.add.image(boardX, boardY, "pie_top_raw").setVisible(false).setDepth(22);

    const ovenZone = this.add.zone(900, 400, 200, 200).setRectangleDropZone(200, 200);
    ovenZone.setData("type", "oven");

    // 재료들 (간단 배치)
    const dough = this.add.image(200, 500, "kitchen_ingredient_dough").setInteractive({ draggable: true }).setDepth(30);
    const lattice = this.add.image(200, 600, "kitchen_ingredient_lattice").setInteractive({ draggable: true }).setDepth(30);
    const apple = this.add.image(350, 500, "kitchen_ingredient_apple").setInteractive({ draggable: true }).setDepth(30);

    // 드래그 로직
    this.input.on("dragstart", (_p, g: any) => g.setDepth(50));
    this.input.on("drag", (_p, g: any, x: number, y: number) => g.setPosition(x, y));

    this.input.on("dragend", (_p, g: Phaser.GameObjects.Image) => {
      const dx = g.x - boardX, dy = g.y - boardY;
      const onBoard = (dx * dx + dy * dy) <= 150 * 150;
      const key = g.texture.key;

      if (onBoard) {
        if (key === "kitchen_ingredient_dough") {
          this.pie.hasDough = true;
          pieBottom.setVisible(true).setTexture("pie_bottom_raw");
        } else if (key === "kitchen_ingredient_lattice" && this.pie.hasDough) {
          this.pie.lattice = true;
          pieTop.setVisible(true).setTexture("pie_top_raw");
        } else if (key === "kitchen_ingredient_apple" && this.pie.hasDough) {
          this.pie.filling = "pie_jam_apple";
          pieJam.setTexture("pie_jam_apple").setVisible(true);
        }
      }
      g.setPosition((g as any).data?.origX ?? g.x, (g as any).data?.origY ?? g.y);
    });

    // 오븐 타이머 작동
    this.input.on("drop", (_p, g: any, z: any) => {
      if (z.getData("type") === "oven" && this.pie.hasDough) {
        this.activateOvenTimer(pieBottom, pieTop);
      }
    });

    this.setKitchenVisible(false);
  }

  private activateOvenTimer(pieBottom: Phaser.GameObjects.Image, pieTop: Phaser.GameObjects.Image) {
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
        pieBottom.setTexture("pie_bottom_cooked");
        if (this.pie.lattice) pieTop.setTexture("pie_top_cooked");
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private toKitchen() {
    if (this.isKitchen) return;
    this.isKitchen = true;

    this.hallBg.setVisible(false);
    this.kitchenBg.setVisible(true);
    this.hallArrow.setVisible(false);
    this.kitchenArrow.setVisible(true);

    this.customer.setVisible(false);
    this.hallCounter.setVisible(false);
    this.textbox.setVisible(false);
    this.setKitchenVisible(true);
  }

  private toHall() {
    if (!this.isKitchen) return;
    this.isKitchen = false;

    this.hallBg.setVisible(true);
    this.kitchenBg.setVisible(false);
    this.hallArrow.setVisible(true);
    this.kitchenArrow.setVisible(false);

    this.customer.setVisible(true);
    this.hallCounter.setVisible(true);
    this.textbox.setVisible(true);
    this.setKitchenVisible(false);
  }

  private setKitchenVisible(v: boolean) {
    this.children.each(ch => {
      if (ch instanceof Phaser.GameObjects.Image && ch.depth >= 10 && ch.depth <= 60) {
        const key = ch.texture.key;
        if (key.startsWith("pie_") || key.startsWith("kitchen_")) ch.setVisible(v);
      }
    });
  }
}
