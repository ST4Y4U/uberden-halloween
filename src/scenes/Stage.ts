import Phaser from "phaser";
import { getGameState, setGameState } from "@/data/state";
import { loadStageData, StageData } from "@/data/loadStage";

const PIE_OFFSET = { x: 0, y: -90 };

export default class Stage extends Phaser.Scene {
  constructor(){ super("Stage"); }

  private stageData!: StageData;

  private pie = { hasDough:false, cooked:false, filling:null as string|null, lattice:false, toppings:new Set<string>() };
  private toppingSprites: Phaser.GameObjects.Image[] = [];
  private doughMode: "dough" | "lattice" = "dough";
  private isBaking = false;

  private boardPos = { x: 720, y: 520, r: 170 };
  private boardImg!: Phaser.GameObjects.Image;
  private pieGroup!: Phaser.GameObjects.Container;
  private pieBottom!: Phaser.GameObjects.Image;
  private pieJam!: Phaser.GameObjects.Image;
  private pieTop!: Phaser.GameObjects.Image;

  private ovenTimer!: Phaser.GameObjects.Image;
  private timerFrames: string[] = ["kitchen_oven_timer_1","kitchen_oven_timer_2","kitchen_oven_timer_3","kitchen_oven_timer_4"];
  private bakeTimeSec = 4;

  preload(){
    this.load.image("kitchen_background", "assets/images/kitchen_background.webp");
    this.load.image("pie_cuttingboard", "assets/images/pie_cuttingboard.png");
    this.load.image("pie_bottom_raw", "assets/images/pie_bottom_raw.png");
    this.load.image("pie_bottom_cooked", "assets/images/pie_bottom_cooked.png");
    this.load.image("pie_top_raw", "assets/images/pie_top_raw.png");
    this.load.image("pie_top_cooked", "assets/images/pie_top_cooked.png");
    this.load.image("kitchen_arrow", "assets/images/kitchen_arrow.png");

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

  async create(){
    this.stageData = await loadStageData(getGameState().stageId || 1);

    this.input.topOnly = true;
    this.input.dragDistanceThreshold = 8;
    this.add.image(640, 360, "kitchen_background").setOrigin(0.5).setDepth(-1000);

    // JSON 위치들
    const ui = (this.stageData as any).ui;
    const lay = (this.stageData as any).layout?.kitchen;

    // 보드 위치/반경
    if (lay?.board) this.boardPos = { x: lay.board.x, y: lay.board.y, r: lay.board.r ?? 170 };

    this.boardImg = this.add.image(this.boardPos.x, this.boardPos.y, "pie_cuttingboard").setDepth(10);

    // 파이 컨테이너
    this.pieGroup = this.add.container(this.boardPos.x, this.boardPos.y).setDepth(22).setVisible(false);
    this.pieBottom = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_bottom_raw").setVisible(false);
    this.pieJam    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_jam_apple").setVisible(false);
    this.pieTop    = this.add.image(PIE_OFFSET.x, PIE_OFFSET.y, "pie_top_raw").setVisible(false);
    this.pieGroup.add([this.pieBottom, this.pieJam, this.pieTop]);
    this.pieGroup.setSize(320, 220);
    this.pieGroup.setInteractive(new Phaser.Geom.Rectangle(-160,-110,320,220), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(this.pieGroup, true);
    this.input.on("drag", (_p,g,dx,dy)=>{ if(g===this.pieGroup)this.pieGroup.setPosition(dx,dy); });

    // 타이머
    const timerCfg = lay?.timer;
    this.ovenTimer = this.add.image(timerCfg?.x ?? 1030, timerCfg?.y ?? 240, (timerCfg?.frames?.[0] ?? "kitchen_oven_timer_1")).setDepth(20).setVisible(false);
    this.timerFrames = timerCfg?.frames ?? this.timerFrames;
    this.bakeTimeSec = (this.stageData as any)?.bakeTimeSec ?? 4;

    // 홀 이동 화살표
    const arrowHall = ui?.arrowToHall ?? { x: 96, y: 648 };
    this.add.image(arrowHall.x, arrowHall.y, "kitchen_arrow")
      .setOrigin(0.5)
      .setDepth(200)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Hall"));

    // 공용 드래그 스폰 헬퍼
    const attachSpawnDrag=(zone:any,getKey:()=>string,onDrop:(t:Phaser.GameObjects.Image)=>void)=>{
      let token:Phaser.GameObjects.Image|null=null;
      const move=(p:any)=>{if(token)token.setPosition(p.worldX,p.worldY);};
      zone.on("dragstart",(pointer:any)=>{
        const key=getKey(); if(!key)return;
        token=zone.scene.add.image(pointer.worldX,pointer.worldY,key).setDepth(101);
        zone.scene.input.on("pointermove",move);
      });
      zone.on("drag",(p:any)=>move(p));
      zone.on("dragend",()=>{
        if(token){onDrop(token);token.destroy();token=null;}
        zone.scene.input.off("pointermove",move);
      });
    };

    // 도우 슬롯
    const doughSlot = lay?.bins?.doughSlot;
    if (doughSlot) {
      const shelf = this.add.zone(doughSlot.x, doughSlot.y, 120, 90).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(100);
      this.input.setDraggable(shelf,true);
      let downTime=0,downX=0,downY=0,startedDrag=false;
      if (doughSlot.cycleOnTap) {
        shelf.on("pointerdown",(p:any)=>{downTime=p.downTime;downX=p.worldX;downY=p.worldY;startedDrag=false;});
        shelf.on("dragstart",()=>startedDrag=true);
        shelf.on("pointerup",(p:any)=>{
          const dt=p.upTime-downTime,dist=Math.hypot(p.worldX-downX,p.worldY-downY);
          if(!startedDrag&&dt<250&&dist<8){
            this.doughMode=this.doughMode==="dough"?"lattice":"dough";
            const label=doughSlot.label;
            if(label){
              const text = this.doughMode==="dough" ? label.textDough : label.textLattice;
              const txt=this.add.text(label.x,label.y,text,{fontFamily:"sans-serif",fontSize:String(label.fontSize??18)+"px",color:label.color??"#6E2B8B"})
                .setOrigin(0.5).setDepth(150);
              this.tweens.add({targets:txt,y:txt.y-20,alpha:0,duration:500,onComplete:()=>txt.destroy()});
            }
          }
        });
      }
      attachSpawnDrag(shelf,()=>{
        return this.doughMode==="dough"
          ? (doughSlot.alternatives?.find((a:any)=>a.mapsTo==="pie_bottom_raw")?.key ?? "kitchen_ingredient_dough")
          : (doughSlot.alternatives?.find((a:any)=>a.mapsTo==="pie_top_raw")?.key ?? "kitchen_ingredient_lattice");
      },(token)=>{
        const dx=token.x-this.boardPos.x,dy=token.y-this.boardPos.y,onBoard=(dx*dx+dy*dy)<=((this.boardPos.r??170)**2);
        if(!onBoard)return;
        const key=token.texture.key;
        if(this.pie.cooked)return;
        if(key==="kitchen_ingredient_dough"){
          if(this.pie.hasDough)return;
          this.pie.hasDough=true;this.pie.cooked=false;this.pie.filling=null;this.pie.lattice=false;this.clearToppings();
          this.pieGroup.setVisible(true);
          this.pieBottom.setTexture("pie_bottom_raw").setVisible(true);
          this.pieJam.setVisible(false);this.pieTop.setVisible(false);
          this.syncToGlobal();
        }else if(key==="kitchen_ingredient_lattice"){
          if(!this.pie.hasDough)return;
          this.pie.lattice=true;this.pieTop.setTexture("pie_top_raw").setVisible(true);
          this.syncToGlobal();
        }
      });
    }

    // 필링 바구니들
    (lay?.bins?.fillings ?? []).forEach((b:any)=>{
      const z=this.add.zone(b.x,b.y,120,100).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(100);
      this.input.setDraggable(z,true);
      attachSpawnDrag(z,()=>b.key,(token)=>{
        const dx=token.x-this.boardPos.x,dy=token.y-this.boardPos.y,onBoard=(dx*dx+dy*dy)<=((this.boardPos.r??170)**2);
        if(!onBoard)return;
        if(this.pie.hasDough&&!this.pie.cooked){
          const jam=b.mapsTo;
          if(jam){this.pie.filling=jam;this.pieJam.setTexture(jam).setVisible(true);this.syncToGlobal();}
        }
      });
    });

    // 토핑 존
    (lay?.bins?.toppings ?? []).forEach((t:any)=>{
      const z=this.add.zone(t.x,t.y,95,93).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(100);
      this.input.setDraggable(z,true);
      attachSpawnDrag(z,()=>t.key,(token)=>{
        const dx=token.x-this.boardPos.x,dy=token.y-this.boardPos.y,onBoard=(dx*dx+dy*dy)<=((this.boardPos.r??170)**2);
        if(!onBoard||!this.pie.cooked)return;
        if(!this.pie.toppings.has(t.key)){
          this.pie.toppings.add(t.key);
          const img=this.add.image(PIE_OFFSET.x,PIE_OFFSET.y,t.key).setDepth(23);this.pieGroup.add(img);this.toppingSprites.push(img);
          this.syncToGlobal();
        }
      });
    });

    // 매직 잠금 (있을 경우)
    if (lay?.magic?.lock && lay?.magic?.key) {
      const lock = lay.magic.lock; // {key,x,y,w,h}
      const key  = lay.magic.key;  // {key,x,y}
      this.add.image(lock.x,lock.y,lock.key).setDepth(18).setVisible(true);
      this.add.image(key.x,key.y,key.key).setDepth(100).setVisible(true);

      const lockRect=new Phaser.Geom.Rectangle(lock.x-(lock.w??72)/2,lock.y-(lock.h??72)/2,lock.w??72,lock.h??72);
      const keyZone=this.add.zone(key.x,key.y,60,40).setOrigin(0.5).setInteractive({useHandCursor:true}).setDepth(101);
      this.input.setDraggable(keyZone,true);
      const attachSpawnDrag=(zone:any,getKey:()=>string,onDrop:(t:Phaser.GameObjects.Image)=>void)=>{
        let token:Phaser.GameObjects.Image|null=null;
        const move=(p:any)=>{if(token)token.setPosition(p.worldX,p.worldY);};
        zone.on("dragstart",(pointer:any)=>{const k=getKey(); if(!k)return; token=zone.scene.add.image(pointer.worldX,pointer.worldY,k).setDepth(101); zone.scene.input.on("pointermove",move);});
        zone.on("drag",(p:any)=>move(p));
        zone.on("dragend",()=>{if(token){onDrop(token); token.destroy(); token=null;} zone.scene.input.off("pointermove",move);});
      };
      attachSpawnDrag(keyZone,()=> key.key,(token)=>{
        if(Phaser.Geom.Intersects.RectangleToRectangle(token.getBounds(),lockRect)){
          // 잠금 해제: 특별 로직이 필요하면 여기서 처리 (필요시 상태 저장 가능)
          const t=this.add.text(lock.x, lock.y-70, "UNLOCKED", {fontFamily:"sans-serif",fontSize:"20px",color:"#6E2B8B"}).setOrigin(0.5).setDepth(150);
          this.tweens.add({targets:t,y:t.y-18,alpha:0,duration:700,onComplete:()=>t.destroy()});
        }
      });
    }

    // 오븐/버너 영역
    const ovenZ = lay?.ovenZone ?? { x: 1030, y: 300, w: 250, h: 260 };
    const burnZ = lay?.burnZone ?? { x: 1030, y: 640, w: 260, h: 120 };
    const oven=this.add.zone(ovenZ.x,ovenZ.y,ovenZ.w,ovenZ.h).setOrigin(0.5).setRectangleDropZone(ovenZ.w,ovenZ.h);
    const burn=this.add.zone(burnZ.x,burnZ.y,burnZ.w,burnZ.h).setOrigin(0.5).setRectangleDropZone(burnZ.w,burnZ.h);

    this.input.on("drop",(_p:any,g:any,zone:any)=>{
      if(g!==this.pieGroup)return;
      if(zone===oven&&this.pie.hasDough){this.activateOvenTimer();return;}
      if(zone===burn)this.resetPie();
      if(!this.isBaking)this.pieGroup.setVisible(true).setPosition(this.boardPos.x,this.boardPos.y);
    });
    this.input.on("dragend",(_p:any,g:any)=>{if(g===this.pieGroup&&!this.isBaking)this.pieGroup.setVisible(true).setPosition(this.boardPos.x,this.boardPos.y);});
  }

  private mapKitchenToJam(k:string){return `pie_jam_${k.replace("kitchen_ingredient_","")}`;}

  private clearToppings(){for(const s of this.toppingSprites)s.destroy();this.toppingSprites.length=0;this.pie.toppings.clear();}

  private syncToGlobal(){
    const S = getGameState();
    S.pie = {
      cooked:  this.pie.cooked,
      filling: this.pie.filling,
      lattice: this.pie.lattice,
      toppings: Array.from(this.pie.toppings)
    };
    setGameState(S);
  }

  private activateOvenTimer(){
    this.isBaking=true;
    // 보이되 드래그만 금지
    this.input.setDraggable(this.pieGroup,false);

    // 총 굽는 시간(bakeTimeSec)을 프레임 수로 등분
    const frames = this.timerFrames;
    const stepMs = Math.max(150, Math.floor((this.bakeTimeSec*1000) / frames.length));

    this.ovenTimer.setVisible(true).setTexture(frames[0]);
    let i=0;
    const tick=()=>{
      i++;
      if(i<frames.length){
        this.ovenTimer.setTexture(frames[i]);
        this.time.delayedCall(stepMs,tick);
      }else{
        // 완료
        this.ovenTimer.setVisible(false);
        this.pie.cooked=true;
        this.pieBottom.setTexture("pie_bottom_cooked").setVisible(true);
        if(this.pie.lattice) this.pieTop.setTexture("pie_top_cooked").setVisible(true);

        // 드래그 재활성
        this.input.setDraggable(this.pieGroup,true);

        this.isBaking=false;
        this.syncToGlobal();
      }
    };
    this.time.delayedCall(stepMs,tick);
  }

  private resetPie(){
    this.pie.hasDough=false;this.pie.cooked=false;this.pie.filling=null;this.pie.lattice=false;
    this.clearToppings();
    this.pieBottom.setVisible(false);this.pieJam.setVisible(false);this.pieTop.setVisible(false);
    this.syncToGlobal();
  }
}
