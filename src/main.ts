import Phaser from "phaser";
import Boot from "./scenes/Boot";
import MainMenu from "./scenes/MainMenu";
import Hall from "./scenes/Hall";
import Stage from "./scenes/Stage";
import Result from "./scenes/Result";

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
  scene: [Boot, MainMenu, Hall, Stage, Result],
});
