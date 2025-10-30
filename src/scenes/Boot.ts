import Phaser from "phaser";

export default class Boot extends Phaser.Scene {
  constructor() { super("Boot"); }
  preload() { /* 전역 폰트/공통 리소스 필요하면 여기서 */ }
  create() { this.scene.start("MainMenu"); }
}
