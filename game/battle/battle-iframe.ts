import { items } from './battle/js/items';
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
const { player, enemy, items: playerItems } = await d4.waitForMessage<{player: Pokemon, enemy: Pokemon, items: { [key: string] : number }}>();
console.log(player, enemy);
battleState.self.party.push(player);
const opponent = {
    items: new Map(),
    party: [enemy],
};
battleState.self.items = new Map();
for (const [key, value] of Object.entries(playerItems)) {
    battleState.self.items.set(items.find(item => item.name === key), value);
}
setBattleMode(true);
battleState.enemy = opponent;
d4.setIsFullscreen(true);
const result = await startBattle();
const afterItems: {[key: string]: number} = {};
for (const [key, value] of battleState.self.items)
    afterItems[key.name] = value;

d4.sendInput(JSON.stringify({ result, player: battleState.self.party[0], enemy: battleState.enemy.party[0], items: afterItems }) + '\n');
d4.setIsFullscreen(false);