import './css/style.css';
import {gamescreen, initGameScreen} from './gamescreen';
import { battleState, drawBattleGUI, setBattleMode, startBattle } from './gui';
function redraw(){
    draw();
    window.requestAnimationFrame(redraw);
}
function draw() {
    drawBattleGUI();
}
initGameScreen();
gamescreen.classList.add("loaded");
redraw();
const { player, enemy } = await d4.waitForMessage<{player: Pokemon, enemy: Pokemon}>();
console.log(player, enemy);
battleState.self.party.push(player);
const opponent = {
    items: new Map(),
    party: [enemy],
};

if (!opponent.items)
    opponent.items = new Map();
setBattleMode(true);
battleState.enemy = opponent;
d4.setIsFullscreen(true);
const result = await startBattle();
d4.sendInput(JSON.stringify({ result, player: battleState.self.party[0], enemy: battleState.enemy.party[0] }) + '\n');
d4.setIsFullscreen(false);