import Phaser from "phaser";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: {
    preload() {},
    create() {
      this.add
        .text(640, 360, "Uberden Halloween", {
          fontFamily: "sans-serif",
          fontSize: "28px",
          color: "#ffffff"
        })
        .setOrigin(0.5);
    }
  }
});
