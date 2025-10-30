import Phaser from "phaser";

/** --- 좌표 프리셋 (1280x720 기준, 필요시 숫자만 미세조정) --- */
// 주방 핵심
const BOARD_POS   = { x: 720,  y: 625 };  // 도마/파이 중심
const BOARD_HIT_R = 160;
const OVEN_ZONE   = { x: 1040, y: 170, w: 356, h: 246 }; // 오븐 도어 영역
const BURN_ZONE   = { x: 1040, y: 440, w: 285, h: 60 }; // 아래 불통
const TIMER_POS   = { x: 1040, y: 200 };                 // 타이머 표시

// 도우 선반(탭=토글, 드래그=현재 모드 꺼내기)
const DOUGH_SHELF = { x: 680, y: 310, w: 140, h: 100 };

// 바구니(배경 포함 요소의 대략 중심/크기)
const BASKETS = {
  pumpkin:   { x:  146, y: 140, w: 120, h: 110 },
  raspberry: { x:  325, y: 140, w: 120, h: 110 },
  blueberry: { x:  500, y: 140, w: 120, h: 110 },
  strawberry:{ x:  680, y: 140, w: 120, h: 110 },
  pecan:     { x:  146, y: 310, w: 120, h: 110 },
  apple:     { x:  325, y: 310, w: 120, h: 110 },
  magic:     { x:  500, y: 310, w: 120, h: 110 } // 자물쇠 위치도 동일 영역
};

// 토핑 바구니(하단 좌측)
const TOPPING_ZONES = {
  cherry:      { x: 90, y: 477, w: 95, h: 93 },
  sugarpowder: { x: 240, y: 477, w: 95, h: 93 },
  sprinkle:    { x: 390, y: 477, w: 95, h: 93 }
};

// 매직 키 (우하단 작은 열쇠)
const MAGIC_KEY = { x: 1240, y: 505, w: 57, h: 21 };

/** --- 씬 --- */
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
    this.load.image("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");   // 밑면
    this.load.image("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png"); // 격자

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
    // 배경
    // create() 초반
    this.input.topOnly = true;            // 겹칠 때 맨 위 인터랙티브만 이벤트 받게
    this.input.dragDistanceThreshold = 8; // 8px 이상 움직여야 실제 드래그로 인식
    
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

    // 주방: 도마/파이 컨테이너
    this.boardImg = this.add.image(BOARD_POS.x, BOARD_POS.y, "pie_cuttingboard").setDepth(10).setVisible(false);
    this.pieGroup = this.add.container(BOARD_POS.x, BOARD_POS.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(0,0,"pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(0,0,"pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(0,0,"pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 파이 컨테이너 드래그가능(통째로 이동)
    this.pieGroup.setSize(320,220);
    this.pieGroup.setInteractive(new Phaser.Geom.Rectangle(-160,-110,320,220), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(this.pieGroup, true);

    // 오븐/소각 드랍존
    const ovenZone = this.add.zone(OVEN_ZONE.x, OVEN_ZONE.y, OVEN_ZONE.w, OVEN_ZONE.h).setRectangleDropZone(OVEN_ZONE.w, OVEN_ZONE.h);
    const burnZone = this.add.zone(BURN_ZONE.x, BURN_ZONE.y, BURN_ZONE.w, BURN_ZONE.h).setRectangleDropZone(BURN_ZONE.w, BURN_ZONE.h);
    (ovenZone as any).name = "oven"; (burnZone as any).name = "burn";

    // 오븐 타이머 (오븐 투입 시에만 표시)
    this.ovenTimer = this.add.image(TIMER_POS.x, TIMER_POS.y, "kitchen_oven_timer_1").setVisible(false).setDepth(20);

    // ───── 재료 꺼내기: "보이는 아이콘 없음" → 선반/라벨 터치로 즉석 토큰 생성 ─────
    const spawnDragToken = (key: string, pointer: Phaser.Input.Pointer) => {
      const token = this.add.image(pointer.worldX, pointer.worldY, key)
        .setDepth(50)
        .setInteractive({ draggable: true, useHandCursor: true })
        .setData("isToken", true);

      this.input.setDraggable(token, true);
      token.on("drag", (_p:any, x:number, y:number) => token.setPosition(x, y));
      token.on("dragend", () => token.destroy()); // 도마 적용 실패 시 소멸
      return token;
    };
    // 도우 선반: 탭→모드 토글, 드래그→현재 모드 토큰
    const doughShelf = this.add.zone(DOUGH_SHELF.x, DOUGH_SHELF.y, DOUGH_SHELF.w, DOUGH_SHELF.h)
      .setOrigin(0.5)
      .setInteractive({ draggable: true, useHandCursor: true })
      .setDepth(35);

    let dragged = false;

    doughShelf.on("dragstart", (pointer) => {
      dragged = true;
      const key = (this.doughMode === "dough") ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice";
      spawnDragToken(key, pointer);
    });

    doughShelf.on("pointerup", () => {
      if (!dragged) {
        this.doughMode = (this.doughMode === "dough") ? "lattice" : "dough";
    // 피드백 텍스트(짧게 떠다 사라짐)
        const label = this.add.text(DOUGH_SHELF.x, DOUGH_SHELF.y - 48,
          this.doughMode === "dough" ? "DOUGH" : "LATTICE",
          { fontFamily: "sans-serif", fontSize: "18px", color: "#6E2B8B" }
        ).setOrigin(0.5).setDepth(36);
        this.tweens.add({ targets: label, y: label.y - 24, alpha: 0, duration: 600, onComplete: () => label.destroy() });
      }
      dragged = false;
    });
    // 과일 바구니들(누르고 끌면 토큰 생성)
    this.makeBasketZone(BASKETS.pumpkin,   ()=>spawnDragToken("kitchen_ingredient_pumpkin"));
    this.makeBasketZone(BASKETS.raspberry, ()=>spawnDragToken("kitchen_ingredient_raspberry"));
    this.makeBasketZone(BASKETS.blueberry, ()=>spawnDragToken("kitchen_ingredient_blueberry"));
    this.makeBasketZone(BASKETS.strawberry,()=>spawnDragToken("kitchen_ingredient_strawberry"));
    this.makeBasketZone(BASKETS.pecan,     ()=>spawnDragToken("kitchen_ingredient_pecan"));
    this.makeBasketZone(BASKETS.apple,     ()=>spawnDragToken("kitchen_ingredient_apple"));

    // 매직 락: 기본 잠금, 키로 해제 후 드래그 가능
    this.magicLockImg = this.add.image(BASKETS.magic.x, BASKETS.magic.y, "kitchen_magic_lock").setDepth(34).setVisible(true);
    this.magicLocked = true;
    const magicBasket = this.add.zone(BASKETS.magic.x, BASKETS.magic.y, BASKETS.magic.w, BASKETS.magic.h)
      .setOrigin(0.5).setInteractive({ draggable:true }).setDepth(33);
    magicBasket.on("dragstart", ()=>{
      if (!this.magicLocked) spawnDragToken("kitchen_ingredient_magic");
    });

    // 키(우하단): 드래그해서 락 영역에 드롭하면 해제
    const keyZone = this.add.zone(MAGIC_KEY.x, MAGIC_KEY.y, MAGIC_KEY.w, MAGIC_KEY.h)
      .setOrigin(0.5).setInteractive({ draggable:true, useHandCursor:true }).setDepth(35);
    keyZone.on("dragstart", ()=> spawnDragToken("kitchen_magic_key"));
    this.input.on("dragend", (_p:any, g:Phaser.GameObjects.Image)=>{
      if (g.texture.key === "kitchen_magic_key") {
        const k = new Phaser.Geom.Rectangle(MAGIC_KEY.x-MAGIC_KEY.w/2, MAGIC_KEY.y-MAGIC_KEY.h/2, MAGIC_KEY.w, MAGIC_KEY.h);
        const lockRect = new Phaser.Geom.Rectangle(BASKETS.magic.x-BASKETS.magic.w/2, BASKETS.magic.y-BASKETS.magic.h/2, BASKETS.magic.w, BASKETS.magic.h);
        const tokenRect = g.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(tokenRect, lockRect)) {
          this.magicLocked = false;
          this.magicLockImg.setVisible(false);
        }
      }
    });

    // ───── 드래그 공통: 토큰→도마 적용 / 파이 컨테이너 이동 ─────
    this.input.on("drag", (_p, g:any, x:number, y:number)=> g.setPosition(x,y));

    // 재료 토큰의 적용(도마 원 충족 시)
    this.input.on("dragend", (_p:any, g:Phaser.GameObjects.Image)=>{
      if (g === this.pieGroup) return; // 파이는 별도 블록에서 처리

      const dx = g.x - BOARD_POS.x, dy = g.y - BOARD_POS.y;
      const onBoard = (dx*dx + dy*dy) <= (BOARD_HIT_R*BOARD_HIT_R);
      const key = g.texture.key;

      if (onBoard) {
        if (key === "kitchen_ingredient_dough") {
          this.pie.hasDough = true; this.pie.cooked = false; this.pie.filling = null;
          this.pie.lattice = false; this.pie.toppings.clear();
          this.boardImg.setVisible(true); this.pieGroup.setVisible(true);
          this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          this.pieJam.setVisible(false); this.pieTop.setVisible(false);
        } else if (key === "kitchen_ingredient_lattice" && this.pie.hasDough) {
          this.pie.lattice = true; this.pieTop.setTexture("pie_top_raw").setVisible(true);
        } else if (key.startsWith("kitchen_ingredient_") && this.pie.hasDough) {
          const mapsTo = this.mapKitchenToJam(key);
          if (mapsTo) { this.pie.filling = mapsTo; this.pieJam.setTexture(mapsTo).setVisible(true); }
        } else if (key.startsWith("pie_ingredient_") && this.pie.cooked) {
          // 토핑은 굽고 난 뒤에만!
          if (!this.pie.toppings.has(key)) {
            this.pie.toppings.add(key);
            const top = this.add.image(this.pieGroup.x, this.pieGroup.y, key).setDepth(23);
            // 파이 컨테이너 상대좌표로 옮김
            this.pieGroup.add(top.setPosition(0,0));
          }
        }
      }
      // 토큰은 1회용: spawn에서 dragend 시 destroy 되므로 추가 처리 불필요
    });

    // 파이 컨테이너 이동 → 오븐/소각
    this.input.on("dragend", (_p:any, g:any)=>{
      if (g !== this.pieGroup) return;

      const pieRect  = this.pieGroup.getBounds();
      const ovenRect = new Phaser.Geom.Rectangle(OVEN_ZONE.x-OVEN_ZONE.w/2, OVEN_ZONE.y-OVEN_ZONE.h/2, OVEN_ZONE.w, OVEN_ZONE.h);
      const burnRect = new Phaser.Geom.Rectangle(BURN_ZONE.x-BURN_ZONE.w/2, BURN_ZONE.y-BURN_ZONE.h/2, BURN_ZONE.w, BURN_ZONE.h);

      if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, ovenRect) && this.pie.hasDough) {
        this.activateOvenTimer();
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(pieRect, burnRect)) {
        this.resetPie();
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
        this.boardImg.setVisible(false);
        this.pieGroup.setVisible(false);
      } else {
        this.pieGroup.setPosition(BOARD_POS.x, BOARD_POS.y);
      }
    });

    // 초기 표시: 홀
    this.setKitchenVisible(false);
  }

  // 바구니 터치존 헬퍼
  private makeBasketZone(rect:{x:number;y:number;w:number;h:number}, onDragStart:()=>void) {
    const z = this.add.zone(rect.x, rect.y, rect.w, rect.h)
      .setOrigin(0.5).setInteractive({ draggable:true, useHandCursor:true }).setDepth(35);
    z.on("dragstart", onDragStart);
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
    // 컨테이너 자식 중 토핑 스프라이트 제거
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
    // 주방 관련 오브젝트만 보이기 조절
    this.boardImg.setVisible(v || this.boardImg.visible);
    this.pieGroup.setVisible(v && this.pieGroup.visible);
    this.ovenTimer.setVisible(v && this.ovenTimer.visible);
    this.magicLockImg.setVisible(v && this.magicLocked);
    // 터치존/드랍존은 보이지 않는 객체라 따로 처리 불필요
  }
}
