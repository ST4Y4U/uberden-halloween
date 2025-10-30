// src/scenes/Stage.ts
import Phaser from "phaser";
import { getGameState, setGameState } from "../data/state.ts";
import { loadStageData, StageData } from "../data/loadStage.ts";

type PieState = {
  hasDough:boolean;
  cooked:boolean;
  filling:string|null;       // "pie_jam_apple" 등
  lattice:boolean;
  toppings:string[];         // "pie_ingredient_cherry" 등
};

const DEPTH = {
  BG: -1000,
  BOARD: 10,
  PIE: 22,
  TIMER: 30,
  LOCK: 34,
  ARROW: 40,
  TOKENS: 101
};

export default class Stage extends Phaser.Scene {
  constructor(){ super("Stage"); }

  private stage!: StageData;

  // 좌표/영역
  private boardPos = { x: 700, y: 520, r: 170, snap: 1 };
  private ovenRect!: Phaser.Geom.Rectangle;
  private burnRect!: Phaser.Geom.Rectangle;

  // 파이 렌더 그룹
  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;

  // UI
  private ovenTimer!: Phaser.GameObjects.Image;
  private timerFrames: string[] = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
  private toHallArrow!: Phaser.GameObjects.Image;
  private magicLockImg?: Phaser.GameObjects.Image;
  private magicKeyImg?: Phaser.GameObjects.Image;

  // 상태
  private pie: PieState = { hasDough:false, cooked:false, filling:null, lattice:false, toppings:[] };
  private doughMode: "dough"|"lattice" = "dough";
  private magicLocked = true;

  preload() {
    // 방어적 리소스 로드(없을 때만)
    const need = (k:string, path:string) => { if (!this.textures.exists(k)) this.load.image(k, path); };
    need("kitchen_background", "assets/images/kitchen_background.webp");
    need("kitchen_arrow",     "assets/images/kitchen_arrow.png");
    need("pie_cuttingboard",  "assets/images/pie_cuttingboard.png");

    ["raw","cooked"].forEach(s=>{
      need(`pie_bottom_${s}`, `assets/images/pie_bottom_${s}.png`);
      need(`pie_top_${s}`,    `assets/images/pie_top_${s}.png`);
    });

    // 필링/바구니 아이콘
    const fills = ["pumpkin","raspberry","blueberry","strawberry","pecan","apple","magic"];
    fills.forEach(f=>{
      need(`kitchen_ingredient_${f}`, `assets/images/kitchen_ingredient_${f}.png`);
      need(`pie_jam_${f}`,            `assets/images/pie_jam_${f}.png`);
    });

    // 도우/격자 토큰
    need("kitchen_ingredient_dough",   "assets/images/kitchen_ingredient_dough.png");
    need("kitchen_ingredient_lattice", "assets/images/kitchen_ingredient_lattice.png");

    // 토핑
    ["cherry","sprinkle","sugarpowder"].forEach(t=>{
      need(`pie_ingredient_${t}`, `assets/images/pie_ingredient_${t}.png`);
    });

    // 타이머/락
    [1,2,3,4].forEach(n=> need(`kitchen_oven_timer_${n}`, `assets/images/kitchen_oven_timer_${n}.png`));
    need("kitchen_magic_lock", "assets/images/kitchen_magic_lock.png");
    need("kitchen_magic_key",  "assets/images/kitchen_magic_key.png");
  }

  async create() {
    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;

    // 스테이지 데이터 로드
    const S = getGameState();
    const stageId = S.stageId || 1;
    this.stage = await loadStageData(stageId);

    // 배경은 항상 맨 뒤
    this.add.image(640, 360, "kitchen_background").setDepth(DEPTH.BG);

    // 레이아웃 반영(기본값 존재)
    const K = this.stage.layout?.kitchen ?? {};
    if (K.board) this.boardPos = { ...this.boardPos, ...K.board };
    const oven = K.ovenZone ?? { x:1030,y:300,w:250,h:260 };
    const burn = K.burnZone ?? { x:1030,y:640,w:260,h:120 };
    this.ovenRect = new Phaser.Geom.Rectangle(oven.x-oven.w/2, oven.y-oven.h/2, oven.w, oven.h);
    this.burnRect = new Phaser.Geom.Rectangle(burn.x-burn.w/2, burn.y-burn.h/2, burn.w, burn.h);
    if (K.timer?.frames) this.timerFrames = K.timer.frames;
    const timerPos = { x: (K.timer?.x ?? 1030), y: (K.timer?.y ?? 240) };

    // 도마(항상 보임)
    this.boardImg = this.add.image(this.boardPos.x, this.boardPos.y, "pie_cuttingboard").setDepth(DEPTH.BOARD);

    // 파이 컨테이너(도마 중심 기준)
    this.pieGroup = this.add.container(this.boardPos.x, this.boardPos.y).setDepth(DEPTH.PIE).setVisible(false);
    this.pieBottom = this.add.image(0, 0, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(0, 0, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(0, 0, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);
    this.input.setDraggable(this.pieGroup, true);

    // 오븐 타이머
    this.ovenTimer = this.add.image(timerPos.x, timerPos.y, this.timerFrames[0]).setDepth(DEPTH.TIMER).setVisible(false);

    // ← 홀로 돌아가는 화살표
    const UI = this.stage.ui ?? {};
    this.toHallArrow = this.add.image(UI.arrowToHall?.x ?? 96, UI.arrowToHall?.y ?? 648, "kitchen_arrow")
      .setDepth(DEPTH.ARROW)
      .setInteractive({ useHandCursor: true });
    this.toHallArrow.on("pointerup", ()=> this.scene.start("Hall"));

    // ───────────── 드래그 토큰 스폰 헬퍼 ─────────────
    const attachSpawnDrag = (
      zone: Phaser.GameObjects.Zone,
      getKey: () => string|undefined,
      onDrop: (token: Phaser.GameObjects.Image) => void,
      lockCheck?: () => boolean   // true면 드래그 취소
    ) => {
      let token: Phaser.GameObjects.Image | null = null;

      const moveWith = (p: Phaser.Input.Pointer) => { if (token) token.setPosition(p.worldX, p.worldY); };

      zone.on("dragstart", (pointer: Phaser.Input.Pointer)=>{
        if (lockCheck && lockCheck()) return;
        const key = getKey();
        if (!key) return;
        token = this.add.image(pointer.worldX, pointer.worldY, key)
          .setDepth(DEPTH.TOKENS)
          .setInteractive({ useHandCursor: true })
          .setData("homeX", zone.x)
          .setData("homeY", zone.y);
        this.input.on("pointermove", moveWith);
      });

      zone.on("drag", (pointer: Phaser.Input.Pointer)=> moveWith(pointer));

      zone.on("dragend", ()=>{
        if (token){
          onDrop(token);
          const homeX = token.getData("homeX"), homeY = token.getData("homeY");
          this.tweens.add({
            targets: token, x: homeX, y: homeY, duration: 160,
            onComplete: ()=> { token?.destroy(); token = null; }
          });
        }
        this.input.off("pointermove", moveWith);
      });
    };

    // ───────────── 도우/격자 슬롯 ─────────────
    // JSON에 doughSlot이 있으면 사용, 없으면 도마 우측 하단 기본값
    const doughSlot = K.bins?.doughSlot ?? { x: this.boardPos.x+240, y: this.boardPos.y+100, cycleOnTap:true };
    const doughZone = this.add.zone(doughSlot.x, doughSlot.y, 120, 100)
      .setOrigin(0.5)
      .setInteractive({ draggable:true, useHandCursor:true })
      .setDepth(DEPTH.ARROW);

    // 탭으로 DOUGH/LATTICE 토글
    doughZone.on("pointerup", (p:Phaser.Input.Pointer, lx:number, ly:number, e:Phaser.Types.Input.EventData)=>{
      if (e && (e as any).wasDragged) return; // 드래그였으면 무시
      this.doughMode = (this.doughMode === "dough") ? "lattice" : "dough";
      // 짧은 라벨 피드백
      const t = this.add.text(doughSlot.x, doughSlot.y-40, this.doughMode.toUpperCase(), { fontFamily:"sans-serif", fontSize:"18px", color:"#6E2B8B" })
        .setOrigin(0.5).setDepth(DEPTH.ARROW);
      this.tweens.add({ targets:t, y:t.y-20, alpha:0, duration:600, onComplete:()=>t.destroy() });
    });

    attachSpawnDrag(
      doughZone,
      ()=> this.doughMode === "dough" ? "kitchen_ingredient_dough" : "kitchen_ingredient_lattice",
      (token)=>{
        // 파이 히트 판정
        const dx = token.x - this.boardPos.x, dy = token.y - this.boardPos.y;
        const onBoard = (dx*dx + dy*dy) <= (this.boardPos.r*this.boardPos.r);
        if (!onBoard) return;

        // 조리 완료 후에는 도우/격자 금지
        if (this.pie.cooked) return;

        if (token.texture.key === "kitchen_ingredient_dough"){
          // 새 반죽 시작(초기화)
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

    // ───────────── 필링 바구니 ─────────────
    const addBasket = (x:number,y:number,w:number,h:number,key:string, mapsTo:string, lockedBy?:string) =>{
      const z = this.add.zone(x,y,w||100,h||100).setOrigin(0.5)
        .setInteractive({ draggable:true, useHandCursor:true })
        .setDepth(DEPTH.ARROW);

      const isLocked = ()=> !!lockedBy && this.magicLocked;

      attachSpawnDrag(
        z, ()=> key,
        (token)=>{
          const dx = token.x - this.boardPos.x, dy = token.y - this.boardPos.y;
          const onBoard = (dx*dx + dy*dy) <= (this.boardPos.r*this.boardPos.r);
          if (!onBoard) return;
          if (!this.pie.hasDough) return;
          if (this.pie.cooked) return; // 구운 뒤에는 필링 교체 금지

          this.pie.filling = mapsTo;
          this.pieJam.setTexture(mapsTo).setVisible(true);
        },
        isLocked
      );
    };

    // JSON 좌표 사용
    const fillings = K.bins?.fillings ?? [];
    fillings.forEach((f:any)=>{
      addBasket(f.x, f.y, f.w||110, f.h||100, f.key, f.mapsTo, f.lockedBy);
    });

    // ───────────── 매직 락/키 ─────────────
    if (K.magic?.lock) {
      const L = K.magic.lock;
      this.magicLockImg = this.add.image(L.x, L.y, L.key).setDepth(DEPTH.LOCK).setVisible(true);
      this.magicLocked = true;
    }
    if (K.magic?.key) {
      const KKEY = K.magic.key;
      this.magicKeyImg = this.add.image(KKEY.x, KKEY.y, KKEY.key)
        .setDepth(DEPTH.ARROW)
        .setInteractive({ draggable:true, useHandCursor:true });

      this.input.setDraggable(this.magicKeyImg, true);
      this.magicKeyImg.on("drag", (_p:Phaser.Input.Pointer, nx:number, ny:number)=>{
        this.magicKeyImg!.setPosition(nx, ny);
      });
      this.magicKeyImg.on("dragend", ()=>{
        if (!this.magicLockImg) return;
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(
          this.magicKeyImg!.getBounds(),
          this.magicLockImg.getBounds()
        );
        if (hit) {
          this.magicLocked = false;
          this.magicLockImg.setVisible(false);
          // 키는 제자리로 복귀 후 그대로 표시 유지(연출용)
          this.magicKeyImg!.setPosition(KKEY.x, KKEY.y);
        } else {
          this.tweens.add({ targets:this.magicKeyImg, x:KKEY.x, y:KKEY.y, duration:140 });
        }
      });
    }

    // ───────────── 토핑 존 ─────────────
    const addTopping = (x:number,y:number,w:number,h:number,key:string)=>{
      const z = this.add.zone(x,y,w||90,h||90).setOrigin(0.5)
        .setInteractive({ draggable:true, useHandCursor:true })
        .setDepth(DEPTH.ARROW);

      attachSpawnDrag(
        z, ()=> key,
        (token)=>{
          const dx = token.x - this.boardPos.x, dy = token.y - this.boardPos.y;
          const onBoard = (dx*dx + dy*dy) <= (this.boardPos.r*this.boardPos.r);
          if (!onBoard) return;
          if (!this.pie.cooked) return; // 구운 뒤에만 토핑 허용
          if (this.pie.toppings.includes(key)) return;

          this.pie.toppings.push(key);
          const top = this.add.image(0,0,key).setDepth(DEPTH.PIE+1);
          this.pieGroup.add(top);
        }
      );
    };

    const toppings = K.bins?.toppings ?? [];
    toppings.forEach((t:any)=> addTopping(t.x, t.y, t.w||90, t.h||90, t.key));

    // ───────────── 파이 드래그: 오븐/소각 ─────────────
    this.input.on("dragend", (_p:any, g:any)=>{
      if (g !== this.pieGroup) return;

      const rect = this.pieGroup.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.ovenRect) && this.pie.hasDough){
        // 굽기
        this.bakePie();
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(rect, this.burnRect)) {
        // 소각
        this.resetPie();
      }
      // 항상 도마로 복귀
      this.pieGroup.setPosition(this.boardPos.x, this.boardPos.y);
    });
  }

  // ───────────── 유틸 ─────────────

  private bakePie(){
    // 굽는 동안 파이 숨김
    this.pieGroup.setVisible(false);
    this.input.setDraggable(this.pieGroup, false);

    this.ovenTimer.setVisible(true).setTexture(this.timerFrames[0]);
    let i = 0;
    const tick = () => {
      i++;
      if (i < this.timerFrames.length){
        this.ovenTimer.setTexture(this.timerFrames[i]);
        this.time.delayedCall(1000, tick);
      } else {
        // 완료
        this.ovenTimer.setVisible(false);
        this.pie.cooked = true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if (this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);
        this.pieGroup.setPosition(this.boardPos.x, this.boardPos.y).setVisible(true);
        this.input.setDraggable(this.pieGroup, true);

        // 글로벌 상태에 파이 결과 저장(홀 판정용)
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

    // 글로벌 상태도 비움
    const S = getGameState();
    S.pie = undefined as any;
    setGameState(S);
  }
}
