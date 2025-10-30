// … (상단 import/상수 동일)

export default class Stage extends Phaser.Scene {
  constructor() { super("Stage"); }

  // … (필드들 동일)

  // ▼ 상태 저장/복원 유틸
  private savePieState() {
    this.registry.set("pieState", {
      hasDough: this.pie.hasDough,
      cooked:   this.pie.cooked,
      filling:  this.pie.filling,
      lattice:  this.pie.lattice,
      toppings: [...this.pie.toppings],
    });
  }
  private applyPieState(state: any) {
    if (!state) return;
    this.pie.hasDough = !!state.hasDough;
    this.pie.cooked   = !!state.cooked;
    this.pie.filling  = state.filling ?? null;
    this.pie.lattice  = !!state.lattice;
    this.pie.toppings = new Set(state.toppings ?? []);

    if (this.pie.hasDough) {
      this.pieGroup.setVisible(true);
      this.pieBottom.setTexture(this.pie.cooked ? "pie_bottom_cooked" : "pie_bottom_raw").setVisible(true);
      if (this.pie.filling) this.pieJam.setTexture(this.pie.filling).setVisible(true);
      else this.pieJam.setVisible(false);
      if (this.pie.lattice) this.pieTop.setTexture(this.pie.cooked ? "pie_top_cooked" : "pie_top_raw").setVisible(true);
      else this.pieTop.setVisible(false);
    } else {
      this.pieGroup.setVisible(false);
      this.pieBottom.setVisible(false);
      this.pieJam.setVisible(false);
      this.pieTop.setVisible(false);
    }
  }

  create() {
    // … (기존 주방 설정 그대로)

    // ▼ create 끝부분에 복원 호출
    this.applyPieState(this.registry.get("pieState"));

    // ▼ Hall로 나가기 화살표(좌하단) — 누를 때 저장 후 이동
    const toHallArrow = this.add.image(80, 640, "kitchen_arrow")
      .setFlipX(true)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });
    toHallArrow.on("pointerup", () => {
      this.savePieState();
      this.scene.start("Hall");
    });

    // … (끝)
  }

  // ▼ 반죽/격자/속/토핑/굽기/리셋 등 “상태가 바뀌는 지점”마다 savePieState() 호출
  // 예) 반죽 성공 직후:
  // this.savePieState();

  // 예) 격자 성공 직후:
  // this.savePieState();

  // 예) 속/토핑 추가 직후, 굽기 완료 직후, resetPie() 마지막에도:
  // this.savePieState();

  // … (나머지 메서드들 동일)
}
