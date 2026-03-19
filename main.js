import { Game } from "./src/engine/Game.js";

const game = new Game();
game.start().catch((err) => {
  console.error("Game boot failed", err);
});
