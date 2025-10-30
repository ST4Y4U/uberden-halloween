import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state";

type PieState = {
  hasDough: boolean;
  cooked: boolean;
  filling: string | null;
  lattice: boolean;
  toppings: string[];
};

const DEPTH = {
  BG: -1000,
  BOARD: 10,
  PIE: 22,
  TIMER: 30,
  LOCK: 34,
  ARROW: 40,
  TOKENS: 101,
};

// 시각 오프셋: 도마 중심에서 살짝 위로 띄워 보이게
const PIE_OFFSET = { x: 0, y: -90 };

// 위치 수동 지정
const POS = {
  background: { x: 640, y: 360 },
  board:      { x: 720, y: 620, r: 170, snap: 1 },
  oven:       { x: 1040, y: 175, w: 250, h: 260 },
  burn:       { x: 1040, y: 440, w: 260, h: 120 },
  timer:      { x: 1040, y: 220, frames: ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"] },
  arrowHall:  { x: 68,  y: 648 },

  // 도우/격자 토글 & 드래그 슬롯
  doughSlot:  { x: 680, y: 300 },

  // 필링 바구니(배경 포함 요소의 대략 중심/사이즈는 zone에서 잡음)
  fillings: {
    pumpkin:   { x: 143, y: 130, key: "kitchen_ingredient_pumpkin",   mapsTo: "pie_jam_pumpkin" },
    raspberry: { x: 325, y: 130, key: "kitchen_ingredient_raspberry", mapsTo: "pie_jam_raspberry" },
    blueberry: { x: 500, y: 130, key: "kitchen_ingredient_blueberry", mapsTo: "pie_jam_blueberry" },
    strawberry:{ x: 680, y: 130, key: "kitchen_ingredient_strawberry",mapsTo: "pie_jam_strawberry" },
    pecan:     { x: 143, y: 300, key: "kitchen_ingredient_pecan",     mapsTo: "pie_jam_pecan" },
    apple:     { x: 325, y: 300, key: "kitchen_ingredient_apple",     mapsTo: "pie_jam_apple" },
    magic:     { x: 500, y: 300, key: "kitchen_ingredient_magic",     mapsTo: "pie_jam_magic", lockedBy: "kitchen_magic_lock" },
  },

  // 토핑 존
  toppings: {
    cherry:      { x: 95, y: 475, key: "pie_ingredient_cherry" },
    sprinkle:    { x: 391, y: 475, key: "pie_ingredient_sprinkle" },
    sugarpowder: { x: 242, y: 475, key: "pie_ingredient_sugarpowder" },
  },

  // 매직 락/키
  magic: {
    lock: { key: "kitchen_magic_lock", x: 580, y: 300, w: 72, h: 72 },
    key:  { key: "kitchen_magic_key",  x: 1240, y: 500 },
  },
};

export default class Stage extends Phaser.Scene {
  constructor(){ super("Stage"); }

  private pie: PieState = { hasDough:false, cooked:false, filling:null, lattice:false, toppings:[] };
  private doughMode: "dough" | "lattice" = "dough";
  private magicLocked = true;

  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;
  private ovenTimer!: Phaser.GameObjects.Image;
  private magicLockImg?: Phaser.GameObjects.Image;
  private magicKeyImg?: Phaser.GameObjects.Image;

  private ovenRect!: Phaser.Geom.Rectangle;
  private burnRect!: Phaser.Geom.Rectangle;

  preload() {
    const need = (k:string, p:string)=>{ if (!this.textures.exists(k)) this.load.image(k,p); };

    need("kitchen_background","assets/images/kitchen_background.webp");
    need("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    need("kitchen_arrow",    "assets/images/kitchen_arrow.png");

    ["raw","cooked"].forEach(s=>{
      need(`pie_bottom_${s}`, `assets/images/pie_bottom_${s}.png`);
      need(`pie_top_${s}`,    `assets/images/pie_top_${s}.png`);
    });

    ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"].forEach(f=>{
      need(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      need(`pie_jam_${f}`,            `assets/images/pie_jam_${f}.png`);
    });

    need("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    need("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    ["cherry","sprinkle","sugarpowder"].forEach(t=>{
      need(`pie_ingredient_${t}`, `assets/images/pie_ingredient_${t}.png`);
    });

    [1,2,3,4].forEach(n=> need(`kitchen_oven_timer_${n}`, `assets/images/kitchen_oven_timer_${n}.png`));
    need("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    need("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  create() {
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    this.add.image(POS.background.x, POS.background.y, "kitchen_background").setDepth(DEPTH.BG);

    this.ovenRect = new Phaser.Geom.Rectangle(POS.oven.x-POS.oven.w/2, POS.oven.y-POS.oven.h/2, POS.oven.w, POS.oven.h);
    this.burnRect = new Phaser.Geom.Rectangle(POS.burn.x-POS.burn.w/2, POS.burn.y-POS.burn.h/2, POS.burn.w, POS.burn.h);

    this.boardImg = this.add.image(POS.board.x, POS.board.y, "pie_cuttingboard").setDepth(DEPTH.BOARD);

    // 파이 컨테이너(도마 위, 시각 오프셋)
    this.pieGroup = this.add.container(POS.board.x, POS.board.y).setDepth(DEPTH.PIE).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);

    // 컨테이너 hit-area (드래그는 가능하지만 항상 스냅백 → 화면상 “안 움직이는 느낌”)
    const r = POS.board.r ?? 170;
    this.pieGroup.setSize(r*2, r*2);
    this.pieGroup.setInteractive(new Phaser.Geom.Circle(0,0,r), Phaser.Geom.Circle.Contains);
    this.input.setDraggable(this.pieGroup, true);

    // 타이머
    this.ovenTimer = this.add.image(POS.timer.x, POS.timer.y, POS.timer.frames[0]).setDepth(DEPTH.TIMER).setVisible(false);

    // ← Hall
    this.add.image(POS.arrowHall.x, POS.arrowHall.y, "kitchen_arrow")
      .setDepth(DEPTH.ARROW)
      .setInteractive({ useHandCursor:true })
      .on("pointerup", ()=> this.scene.start("Hall"));

    // 공통 토큰 스폰 헬퍼 (드랍 후 원위치로 트윈 복귀 → “다시 돌아가는” 시각 효과)
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: () => string | undefined,
      onDrop: (token: Phaser.GameObjects.Image) => void,
      lockCheck?: () => boolean
    ) => {
      let token: Phaser.GameObjects.Image | null = null;
      const moveWith = (p: Phaser.Input.Pointer) => { if (token) token.setPosition(p.worldX, p.worldY); };

      zone.on("dragstart", (pointer: Phaser.Input.Pointer)=>{
        if (lockCheck && lockCheck()) return;
        const key = getKey(); if (!key) return;
        token = this.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(DEPTH.TOKENS)
          .setInteractive({ useHandCursor:true })
          .setData("homeX", zone.x).setData("homeY", zone.y);
        this.input.on("pointermove", moveWith);
      });
      zone.on("drag", (p:Phaser.Input.Pointer)=> moveWith(p));
      zone.on("dragend", ()=>{
        if (token){
          onDrop(token);
          const homeX = token.getData("homeX"), homeY = token.getData("homeY");
          this.tweens.add({ targets: token, x: homeX, y: homeY, duration: 160,
            onComplete: ()=> { token?.destroy(); token = null; }});
        }
        this.input.off("pointermove", moveWith);
      });
    };

    // 도우/격자 슬롯
    const doughZone = this.add.zone(POS.doughSlot.x, POS.doughSlot.y, 120, 100)
      .setOrigin(0.5).setDepth(DEPTH.ARROW)
      .setInteractive({ draggable:true, useHandCursor:true });

    doughZone.on("pointerup", (_p:any,_lx:number,_ly:number,e:any)=>{
      if (e && e.wasDragged) return; // 드래그였다면 토글 X
      this.doughMode = (this.doughMode === "dough") ? "lattice" : "dough";
      const t = this.add.text(POS.doughSlot.x, POS.doughSlot.y-40, this.doughMode.toUpperCase(),
        { fontFamily:"sans-serif", fontSize:"18px", color:"#6E2B8B" }).setOrigin(0.5).setDepth(DEPTH.ARROW);
      this.tweens.add({ targets:t, y:t.y-20, alpha:0, duration:600, onComplete:()=>t.destroy() });
    });

    attachSpawnDrag(
      doughZone,
      ()=> this.doughMode === "dough" ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice",
      (token)=>{
        const onBoard = this.isOnBoard(token.x, token.y);
        if (!onBoard) return;
        if (this.pie.cooked) return;

        if (token.texture.key === "kitchen_ingredient_dough"){
          // 새 반죽 시작
          this.pie = { hasDough:true, cooked:false, filling:null, lattice:false, toppings:[] };
          this.pieGroup.setVisible(true);
          this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          this.pieJam.setVisible(false);
          this.pieTop.setVisible(false);
        } else {
          if (!this.pie.hasDough) return;
          this.pie.lattice = true;
          this.pieTop.setTexture("pie_top_raw").setVisible(true);
        }
      }
    );

    // 필링 바구니
    const addFilling = (x:number, y:number, key:string, mapsTo:string, lockedBy?:string)=>{
      const z = this.add.zone(x,y,110,100).setOrigin(0.5).setDepth(DEPTH.ARROW)
        .setInteractive({ draggable:true, useHandCursor:true });
      const isLocked = ()=> !!lockedBy && this.magicLocked;
      attachSpawnDrag(
        z, ()=> key,
        (token)=>{
          if (!this.isOnBoard(token.x, token.y)) return;
          if (!this.pie.hasDough) return;
          if (this.pie.cooked) return;
          this.pie.filling = mapsTo;
          this.pieJam.setTexture(mapsTo).setVisible(true);
        },
        isLocked
      );
    };
    Object.values(POS.fillings).forEach((f:any)=> addFilling(f.x, f.y, f.key, f.mapsTo, f.lockedBy));

    // 매직 락/키
    if (POS.magic.lock){
      const L = POS.magic.lock;
      this.magicLockImg = this.add.image(L.x, L.y, L.key).setDepth(DEPTH.LOCK).setVisible(true);
      this.magicLocked = true;
    }
    if (POS.magic.key){
      const K = POS.magic.key;
      this.magicKeyImg = this.add.image(K.x, K.y, K.key).setDepth(DEPTH.ARROW).setInteractive({ useHandCursor:true });
      this.input.setDraggable(this.magicKeyImg, true);
      this.magicKeyImg.on("drag", (_p:Phaser.Input.Pointer, nx:number, ny:number)=> this.magicKeyImg!.setPosition(nx, ny));
      this.magicKeyImg.on("dragend", ()=>{
        if (!this.magicLockImg) return;
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(this.magicKeyImg!.getBounds(), this.magicLockImg.getBounds());
        if (hit){
          this.magicLocked = false;
          this.magicLockImg.setVisible(false);
          this.magicKeyImg!.setPosition(POS.magic.key.x, POS.magic.key.y);
        } else {
          this.tweens.add({ targets:this.magicKeyImg, x:POS.magic.key.x, y:POS.magic.key.y, duration:140 });
        }
      });
    }

    // 토핑(구운 뒤만 가능)
    const addTopping = (x:number,y:number,key:string)=>{
      const z = this.add.zone(x,y,90,90).setOrigin(0.5).setDepth(DEPTH.ARROW)
        .setInteractive({ draggable:true, useHandCursor:true });
      attachSpawnDrag(
        z, ()=> key,
        (token)=>{
          if (!this.isOnBoard(token.x, token.y)) return;
          if (!this.pie.cooked) return;
          if (this.pie.toppings.includes(key)) return;
          this.pie.toppings.push(key);
          const top = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, key).setDepth(DEPTH.PIE+1);
          this.pieGroup.add(top);
        }
      );
    };
    Object.values(POS.toppings).forEach((t:any)=> addTopping(t.x, t.y, t.key));

    // 파이 드래그 종료: 오븐/소각 판정 + 항상 스냅백
    this.input.on("dragend", (_p:any, g:any)=>{
      if (g !== this.pieGroup) return;
      const rect = this.pieGroup.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.ovenRect) && this.pie.hasDough){
        this.bakePie();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.burnRect)){
        this.resetPie();
      }
      this.pieGroup.setPosition(POS.board.x, POS.board.y);
    });

    // 이전에 만든 파이가 있다면(중간 복귀) 도마에 반영
    const G = getGameState();
    if (G.pie?.cooked) {
      this.pie = { hasDough:true, cooked:true, filling:G.pie.filling ?? null, lattice:G.pie.lattice ?? false, toppings:[...(G.pie.toppings ?? [])] };
      this.pieGroup.setVisible(true);
      this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
      if (this.pie.filling) this.pieJam.setTexture(this.pie.filling).setVisible(true);
      if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
      for (const t of this.pie.toppings) {
        const top = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, t).setDepth(DEPTH.PIE+1);
        this.pieGroup.add(top);
      }
    }
  }

  private isOnBoard(x:number, y:number){
    const dx = x - POS.board.x, dy = y - POS.board.y;
    const r = POS.board.r ?? 170;
    return (dx*dx + dy*dy) <= (r*r);
  }

  private bakePie(){
    // 굽는 동안 숨김
    this.pieGroup.setVisible(false);
    this.input.setDraggable(this.pieGroup, false);

    let i = 0;
    this.ovenTimer.setVisible(true).setTexture(POS.timer.frames[0]);
    const tick = () => {
      i++;
      if (i < POS.timer.frames.length){
        this.ovenTimer.setTexture(POS.timer.frames[i]);
        this.time.delayedCall(1000, tick);
      } else {
        this.ovenTimer.setVisible(false);
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(POS.board.x, POS.board.y).setVisible(true);
        this.input.setDraggable(this.pieGroup, true);

        // Hall로 들고갈 스냅샷 저장
        const S = getGameState();
        S.pie = {
          cooked: this.pie.cooked,
          filling: this.pie.filling,
          lattice: this.pie.lattice,
          toppings: [...this.pie.toppings]
        };
        setGameState(S);
      }
    };
    this.time.delayedCall(1000, tick);
  }

  private resetPie(){
    this.pie = { hasDough:false, cooked:false, filling:null, lattice:false, toppings:[] };
    this.pieBottom.setVisible(false);
    this.pieJam.setVisible(false);
    this.pieTop.setVisible(false);

    const S = getGameState();
    delete S.pie;
    setGameState(S);
  }
}
