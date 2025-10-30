// src/scenes/Hall.ts
import Phaser from "phaser";
import { loadStageData, StageData, Line, DialogNode } from "../data/loadStage";
import { getGameState, setGameState, recordEvaluation, advanceStage, computeEnding } from "../data/state";

export default class Hall extends Phaser.Scene {
  constructor(){ super("Hall"); }

  private stageData!: StageData;

  // 스프라이트
  private client!: Phaser.GameObjects.Image;
  private toKitchenArrow!: Phaser.GameObjects.Image;

  // 말풍선 이미지
  private clBox!: Phaser.GameObjects.Image;
  private myBox!: Phaser.GameObjects.Image;

  // 텍스트
  private clText!: Phaser.GameObjects.Text;
  private myText!: Phaser.GameObjects.Text;

  // 선택지
  private choiceA?: Phaser.GameObjects.Text;
  private choiceB?: Phaser.GameObjects.Text;

  // 대화 상태
  private dialogQueue: Line[] = [];
  private awaitingChoice = false;

  // 주방/홀 공유용: 도마에 올라온 파이 스냅샷을 그리기 원하면 state로 전달해 사용할 수 있음
  create = async () => {
    const G = getGameState();
    const stageId = G.stageId || 1;
    this.stageData = await loadStageData(stageId);

    // 배경/카운터/손님
    this.add.image(640, 360, "hall_background").setDepth(-1000);
    this.client = this.add.image(320, 420, this.getClientSprite("standard")).setDepth(10);
    this.add.image(640, 360, "hall_counter").setDepth(12);

    // 말풍선
    this.clBox = this.add.image(960, 305, "hall_textbox").setDepth(20).setVisible(false).setInteractive({ useHandCursor:true });
    this.myBox = this.add.image(325, 550, "hall_mytextbox").setDepth(21).setVisible(false).setInteractive({ useHandCursor:true });

    this.clText = this.add.text(775, 205, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#140605", wordWrap:{ width:520 }
    }).setDepth(31).setVisible(false);

    this.myText = this.add.text(125, 483, "", {
      fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", wordWrap:{ width:420 }
    }).setDepth(32).setVisible(false);

    this.clBox.on("pointerup", () => this.advance());
    this.myBox.on("pointerup", () => this.advance());

    // 주방 화살표 (좌하단 기본 / JSON 덮어쓰기)
    const UI = this.stageData.ui ?? {};
    this.toKitchenArrow = this.add.image(UI.arrowToKitchen?.x ?? 1184, UI.arrowToKitchen?.y ?? 648, "hall_arrow")
      .setDepth(40).setInteractive({ useHandCursor:true })
      .on("pointerup", () => this.scene.start("Stage"));

    // 프리 대화 → 주문 3단계
    const pre = this.stageData.customers?.[0]?.preDialogue ?? [];
    this.dialogQueue = [...pre, { who:"client", text:"", } as any /* tail */];
    this.showNextFromQueue();
  };

  // == 진행 로직 ==
  private getClientSprite(face: "standard"|"happy"|"angry"="standard"){
    const C = this.stageData.customers?.[0];
    const s = C?.sprites || {};
    return s[face] || "client_levin_standard";
  }

  private showNextFromQueue(){
    if (this.awaitingChoice) return;
    const next: any = this.dialogQueue.shift();
    if (!next) { this.beginOrderDialogue(); return; }

    // tail 신호 대신 text가 빈 줄이면 주문으로 전환
    if (!next.text) { this.beginOrderDialogue(); return; }

    if (next.sprite) this.client.setTexture(this.getClientSprite(next.sprite));

    const who = next.who === "player" ? "player" : "client";
    if (who === "client"){
      this.myBox.setVisible(false); this.myText.setVisible(false);
      this.clBox.setVisible(true);  this.clText.setVisible(true).setText(next.text);
    } else {
      this.clBox.setVisible(false); this.clText.setVisible(false);
      this.myBox.setVisible(true);  this.myText.setVisible(true).setText(next.text);
    }
  }

  private beginOrderDialogue(){
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    if (!dlg.length){ this.hideBubbles(); return; }
    const first = dlg.find(n=>n.id==="d1") || dlg[0];
    this.playDialogNode(first.id);
  }

  private playDialogNode(id: string){
    const dlg = this.stageData.customers?.[0]?.dialogue ?? [];
    const node = dlg.find(n=>n.id===id);
    if (!node){ this.hideBubbles(); return; }

    // 손님 말풍선에 노드 출력
    this.clBox.setVisible(true); this.clText.setVisible(true).setText(node.text || "");
    this.myBox.setVisible(false); this.myText.setVisible(false);
    if (node.sprite) this.client.setTexture(this.getClientSprite(node.sprite));

    // 선택지 생성
    this.destroyChoices();
    const cs = node.choices || [];
    if (!cs.length) return;

    this.awaitingChoice = true;
    const makeChoice = (label:string, nextId:string, ox:number) => {
      const t = this.add.text(640 + ox, 640, label, {
        fontFamily:"sans-serif", fontSize:"28px", color:"#F7E2B2", backgroundColor:"#6E2B8B"
      }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor:true });
      t.on("pointerup", ()=>{
        this.awaitingChoice = false; this.destroyChoices();
        if (nextId === "end"){ this.hideBubbles(); }
        else this.playDialogNode(nextId);
      });
      return t;
    };
    if (cs[0]) this.choiceA = makeChoice(cs[0].label, cs[0].next, -160);
    if (cs[1]) this.choiceB = makeChoice(cs[1].label, cs[1].next, +160);
  }

  private destroyChoices(){ this.choiceA?.destroy(); this.choiceB?.destroy(); this.choiceA=undefined; this.choiceB=undefined; }
  private hideBubbles(){ this.clBox.setVisible(false); this.clText.setVisible(false); this.myBox.setVisible(false); this.myText.setVisible(false); }
  private advance(){ if (!this.awaitingChoice) this.showNextFromQueue(); }

  // == 전달 판정 진입점 ==
  // Stage에서 파이 배달이 성공/실패로 판정되면 Hall로 돌아왔을 때 아래 함수를 호출한다고 가정:
  // this.events.emit("DeliverResult", ok:boolean);
  // 본 씬 create() 마지막에 리스너를 등록해둬도 되고, Stage->Hall 전환 시 data로 넘겨도 됨.
  // 여기서는 간단히 공개 메서드로 둔다.
  public onDeliverEvaluated(ok: boolean) {
    recordEvaluation(오케이);

    const last = getGameState().stageId;
    if (last >= 7) {
      // 엔딩 계산 후 결과 씬
      const result = computeEnding(); // "good" | "normal" | "bad"
      this.scene.start("Result", { result });
      return;
    }

    // 다음 스테이지로
    advanceStage();
    this.scene.start("Hall");
  }
}
