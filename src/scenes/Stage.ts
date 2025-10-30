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
  ui: { arrowToKitchen: XY; arrowToHall: XY; textboxClient?: any; textboxHero?: any; textboxArrow?: any; };
  layout: Layout;
  customers: Customer[];
  boss?: any;
};

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  private dataJson!: StageData;
  private isKitchen = false;

  // UI arrows
  private hallArrow!: Phaser.GameObjects.Image;
  private kitchenArrow!: Phaser.GameObjects.Image;

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

    // 최소 자산 로드 (네가 올린 키 기준)
    // UI
    this.load.image("hall_arrow", "assets/images/hall_arrow.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");

    // 보드/파이
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");

    // 타이머 (4~1)
    this.load.image("kitchen_oven_timer_4", "assets/images/kitchen_oven_timer_4.png");
    this.load.image("kitchen_oven_timer_3", "assets/images/kitchen_oven_timer_3.png");
    this.load.image("kitchen_oven_timer_2", "assets/images/kitchen_oven_timer_2.png");
    this.load.image("kitchen_oven_timer_1", "assets/images/kitchen_oven_timer_1.png");

    // 재료(트레이 아이콘)
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    for (const f of fills) this.load.image(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
    // 실제 속(파이에 적용될 이미지)
    for (const f of fills) this.load.image(`pie_jam_${f}`, `assets/images/pie_jam_${f}.png`);

    // 도우/격자 슬롯 아이콘 (같은 그림이어도 키는 분리)
    this.load.image("kitchen_ingredient_dough", "assets/images/kitchen_ingredient_dough.png");
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    // 토핑(아이콘=배치 동일)
    this.load.image("pie_ingredient_cherry", "assets/images/pie_ingredient_cherry.png");
    this.load.image("pie_ingredient_sprinkle", "assets/images/pie_ingredient_sprinkle.png");
    this.load.image("pie_ingredient_sugarpowder", "assets/images/pie_ingredient_sugarpowder.png");

    // 매직
    this.load.image("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    this.load.image("kitchen_magic_key", "assets/images/kitchen_magic_key.png");

    // 고객 임시 예시 (stage JSON에 정의된 스프라이트 키를 여기서 로드해도 됨)
    // 실제로는 Boot에서 일괄 로드하거나, Stage에서 개별 로드해도 무방.
  }

  create() {
    this.dataJson = this.cache.json.get("stage01") as StageData;
    if (!this.dataJson) {
      this.add.text(640, 360, "stage01.json not found", { color: "#ff5555" }).setOrigin(0.5);
      return;
    }

    // 기본 화면: 홀부터
    this.isKitchen = false;

    // 화살표
    this.hallArrow = this.add.image(this.dataJson.ui.arrowToKitchen.x, this.dataJson.ui.arrowToKitchen.y, "hall_arrow").setInteractive({ useHandCursor: true });
    this.kitchenArrow = this.add.image(this.dataJson.ui.arrowToHall.x, this.dataJson.ui.arrowToHall.y, "kitchen_arrow").setInteractive({ useHandCursor: true });

    this.hallArrow.on("pointerdown", () => this.toKitchen());
    this.kitchenArrow.on("pointerdown", () => this.toHall());

    // 도마
    this.board = this.dataJson.layout.kitchen.board;
    const boardImg = this.add.image(this.board.x, this.board.y, "pie_cuttingboard").setDepth(10);
    boardImg.setVisible(false); // 홀일 땐 숨김

    // 드롭 존들
    const oven = this.dataJson.layout.kitchen.ovenZone;
    const burn = this.dataJson.layout.kitchen.burnZone;
    const ovenZone = this.add.zone(oven.x, oven.y, oven.w, oven.h).setRectangleDropZone(oven.w, oven.h);
    const burnZone = this.add.zone(burn.x, burn.y, burn.w, burn.h).setRectangleDropZone(burn.w, burn.h);
    ovenZone.setData("type", "oven");
    burnZone.setData("type", "burn");
    ovenZone.setVisible(false);
    burnZone.setVisible(false);

    // 오븐 타이머 아이콘
    const timerPos = this.dataJson.layout.kitchen.timer;
    const timerFrames = timerPos.frames;
    const timerIcon = this.add.image(timerPos.x, timerPos.y, timerFrames[0]).setVisible(false).setDepth(90);

    // 도우/격자 슬롯 (텍스트 라벨 토글)
    const ds = this.dataJson.layout.kitchen.bins.doughSlot;
    let doughMode: "dough" | "lattice" = ds.mode;
    const doughIcon = this.add.image(ds.x, ds.y, doughMode === "dough" ? ds.alternatives[0].key : ds.alternatives[1].key)
      .setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);
    const modeLabel = this.add.text(ds.label.x, ds.label.y,
      doughMode === "dough" ? ds.label.textDough : ds.label.textLattice,
      { fontFamily: "sans-serif", fontSize: `${ds.label.fontSize}px`, color: ds.label.color }
    ).setOrigin(0.5).setDepth(31);

    doughIcon.on("pointerdown", () => {
      if (!ds.cycleOnTap) return;
      doughMode = doughMode === "dough" ? "lattice" : "dough";
      doughIcon.setTexture(doughMode === "dough" ? ds.alternatives[0].key : ds.alternatives[1].key);
      modeLabel.setText(doughMode === "dough" ? ds.label.textDough : ds.label.textLattice);
    });

    // 파이 레이어 스프라이트
    const pieBottom = this.add.image(this.board.x, this.board.y, "pie_bottom_raw").setVisible(false).setDepth(20);
    const pieJam = this.add.image(this.board.x, this.board.y, "pie_jam_apple").setVisible(false).setDepth(21);
    const pieTop = this.add.image(this.board.x, this.board.y, "pie_top_raw").setVisible(false).setDepth(22);
    const toppingLayer = this.add.layer().setDepth(23);

    // fillings bins
    for (const b of this.dataJson.layout.kitchen.bins.fillings) {
      const icon = this.add.image(b.x, b.y, b.key).setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);
      if (b.lockedBy) {
        // 잠금 오버레이
        const lock = this.dataJson.layout.kitchen.magic.lock;
        const lockImg = this.add.image(lock.x, lock.y, lock.key).setDepth(40);
        // 키는 보스 스테이지에서만 등장(여기선 생략 가능)
        // 편의상: 잠긴 상태면 아이콘 반투명
        icon.setAlpha(0.4);
        icon.on("dragstart", (p: any, g: any) => { p.stop(); }); // 드래그 차단
      }
    }

    // toppings bins
    for (const t of this.dataJson.layout.kitchen.bins.toppings) {
      this.add.image(t.x, t.y, t.key).setInteractive({ draggable: true, useHandCursor: true }).setDepth(30);
    }

    // 드래그 제어 (모든 드래그 가능한 것에 공통 적용)
    this.input.on("dragstart", (_p: any, g: any) => g.setDepth(50));
    this.input.on("drag", (_p: any, g: any, x: number, y: number) => g.setPosition(x, y));

    // 드랍 처리
    this.input.on("drop", (_p: any, g: any, z: any) => {
      const type = z.getData("type");
      if (type === "oven") {
        // 오븐에 파이를 넣었는지 판정: 도우가 있어야 의미
        if (this.pie.hasDough) {
          // 굽기 시작
          timerIcon.setVisible(true);
          timerIcon.setTexture(timerFrames[0]);
          // 1초 간격 4→1
          let idx = 0;
          const tick = () => {
            idx++;
            if (idx < timerFrames.length) {
              timerIcon.setTexture(timerFrames[idx]);
              this.time.delayedCall(1000, tick);
            } else {
              timerIcon.setVisible(false);
              this.pie.cooked = true;
              // 비주얼 교체
              pieBottom.setTexture("pie_bottom_cooked");
              if (this.pie.lattice) pieTop.setTexture("pie_top_cooked");
              // 도마로 복귀 상태 그대로 유지
            }
          };
          this.time.delayedCall(1000, tick);
        }
      } else if (type === "burn") {
        // 소각: 전부 초기화
        this.resetPie(pieBottom, pieJam, pieTop, toppingLayer);
      }
    });

    // 도마 위에 드롭(재료 적용) – 캔버스 좌표로 원판정
    this.input.on("dragend", (_p: any, g: Phaser.GameObjects.Image) => {
      const dx = g.x - this.board.x, dy = g.y - this.board.y;
      const onBoard = (dx * dx + dy * dy) <= (this.board.r * this.board.r);

      if (onBoard) {
        const key = g.texture.key;

        // 도우/격자
        if (key === ds.alternatives[0].key) { // dough
          this.pie.hasDough = true;
          this.pie.cooked = false;
          this.pie.filling = null;
          this.pie.lattice = false;
          this.pie.toppings.clear();
          pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          pieJam.setVisible(false);
          pieTop.setVisible(false);
          toppingLayer.removeAll(true);
        } else if (key === ds.alternatives[1].key) { // lattice
          if (this.pie.hasDough) {
            this.pie.lattice = true;
            pieTop.setTexture("pie_top_raw").setVisible(true);
          }
        }

        // 속
        if (key.startsWith("kitchen_ingredient_") && key !== ds.alternatives[0].key && key !== ds.alternatives[1].key) {
          if (this.pie.hasDough) {
            // mapsTo: pie_jam_*
            const mapsTo = this.mapKitchenToJam(key);
            if (mapsTo) {
              this.pie.filling = mapsTo;
              pieJam.setTexture(mapsTo).setVisible(true);
            }
          }
        }

        // 토핑 (굽기 후에만)
        if (key.startsWith("pie_ingredient_") && this.pie.cooked) {
          // 정확 일치 요구라 덮어쓰기/삭제 없음 → 같은 키가 이미 있으면 무시
          if (!this.pie.toppings.has(key)) {
            this.pie.toppings.add(key);
            const top = this.add.image(this.board.x, this.board.y, key).setDepth(23);
            toppingLayer.add(top);
          }
        }
      }

      // 드래그 아이콘은 원위치로 스냅
      g.setPosition((g as any).data?.origX ?? g.x, (g as any).data?.origY ?? g.y);
    });

    // 아이콘 원위치 저장
    this.input.on("gameobjectdown", (_p: any, g: any) => {
      if (g instanceof Phaser.GameObjects.Image && (g.input?.draggable ?? false)) {
        g.setData("origX", g.x);
        g.setData("origY", g.y);
      }
    });

    // 홀/주방 초기 가시성 정리
    const setKitchenVisible = (v: boolean) => {
      boardImg.setVisible(v);
      // 주방 UI/드랍존/아이콘 레이어 전체 토글
      doughIcon.setVisible(v); modeLabel.setVisible(v);
      ovenZone.setActive(v).setVisible(false);
      burnZone.setActive(v).setVisible(false);
      timerIcon.setVisible(false);
      // fillings/toppings 아이콘은 대충 30~40 깊이로 배치했으니, 주방 아닐 때 숨기는 편이 깔끔
      this.children.each(ch => {
        if (ch instanceof Phaser.GameObjects.Image || ch instanceof Phaser.GameObjects.Text || ch instanceof Phaser.GameObjects.Layer) {
          // 간단 기준: 주방 전용 깊이들
          if (ch.depth >= 20 && ch.depth <= 90) ch.setVisible(v);
        }
      });
    };

    const setHallVisible = (v: boolean) => {
      // 여기서는 고객 1명만 간단히 표시(표정 전환만)
      // 실제 고객 스프라이트는 stage JSON에 맞춰 로드/배치하면 된다.
    };

    setKitchenVisible(false);
    setHallVisible(true);

    // 간단 배달 처리: 홀에서 고객 히트존 클릭 시 평가
    this.input.keyboard?.on("keydown-D", () => { // 임시: D 키 = 배달 시뮬
      if (this.isKitchen) return;
      this.deliverCurrentCustomer(pieBottom, pieJam, pieTop, toppingLayer);
    });
  }

  // 주방 <-> 홀
  private toKitchen() {
    if (this.isKitchen) return;
    this.isKitchen = true;
    this.hallArrow.setVisible(false);
    this.kitchenArrow.setVisible(true);
    // 주방 보이기
    this.children.each(ch => {
      if (ch.depth >= 20 && ch.depth <= 90) ch.setVisible(true);
    });
  }

  private toHall() {
    if (!this.isKitchen) return;
    this.isKitchen = false;
    this.hallArrow.setVisible(true);
    this.kitchenArrow.setVisible(false);
    // 주방 숨기기
    this.children.each(ch => {
      if (ch.depth >= 20 && ch.depth <= 90) ch.setVisible(false);
    });
  }

  private resetPie(bottom: Phaser.GameObjects.Image, jam: Phaser.GameObjects.Image, top: Phaser.GameObjects.Image, layer: Phaser.GameObjects.Layer) {
    this.pie.hasDough = false;
    this.pie.cooked = false;
    this.pie.filling = null;
    this.pie.lattice = false;
    this.pie.toppings.clear();
    bottom.setVisible(false).setTexture("pie_bottom_raw");
    jam.setVisible(false);
    top.setVisible(false).setTexture("pie_top_raw");
    layer.removeAll(true);
  }

  private mapKitchenToJam(key: string): string | null {
    const suffix = key.replace("kitchen_ingredient_", "");
    return `pie_jam_${suffix}`;
  }

  private deliverCurrentCustomer(bottom: Phaser.GameObjects.Image, jam: Phaser.GameObjects.Image, top: Phaser.GameObjects.Image, layer: Phaser.GameObjects.Layer) {
    const cust = this.dataJson.customers[this.customerIndex];
    if (!cust) return;

    const ok = this.evaluate({
      filling: this.pie.filling,
      lattice: this.pie.lattice,
      toppings: this.pie.toppings,
      cooked: this.pie.cooked
    }, cust.order);

    if (ok) this.goodCount++; else this.badCount++;

    // 다음 고객으로
    this.customerIndex++;
    this.resetPie(bottom, jam, top, layer);

    if (this.customerIndex >= 6) {
      // 엔딩 분기
      const ending = (this.goodCount === 6) ? "good" : (this.badCount === 6 ? "bad" : "normal");
      this.scene.start("Result", { ending, good: this.goodCount, bad: this.badCount });
    }
  }

  private evaluate(made: { filling: string|null; lattice: boolean; toppings: Set<string>; cooked: boolean; }, req: { filling: string; needsLattice: boolean; toppings: string[]; exactMatch: true; }): boolean {
    if (!made.cooked) return false; // 반드시 구워야 함
    const fillingOK = (made.filling === req.filling);
    const latticeOK = (made.lattice === req.needsLattice);
    const sameToppings = (made.toppings.size === req.toppings.length) && req.toppings.every(k => made.toppings.has(k));
    return fillingOK && latticeOK && sameToppings;
  }
}
