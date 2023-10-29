import { attemptEscape, rewardKill, statusForPokemon, turn } from "./battle/js/battle";
import { forceLevelUp, definition, moveByName } from "./battle/js/logic";
import { ctx, gamescreen } from "./gamescreen";
import { keyManager } from "./keys";
import { clickSound, playSound } from "./sounds";
import { images as imageURLS } from './images';

import ghost1 from '../monsters/ghost1.png';
import ghost2 from '../monsters/ghost2.png';
import ghost3 from '../monsters/ghost3.png';
import werewolf_front from '../monsters/werewolf_front.png';
import werewolf_back from '../monsters/werewolf_back.png';
import dragon_front from '../monsters/dragon_front.png';
import dragon_back from '../monsters/dragon_back.png';
import fish_front from '../monsters/fish_front.png';
import fish_back from '../monsters/fish_back.png';
const monsterImages = new Map();

function monsterImage(name) {
    const monsterUrls = { ghost1, ghost2, ghost3, werewolf_front, werewolf_back, dragon_front, dragon_back, fish_front, fish_back };
    if (!monsterImages.has(name)) {
        const img = new Image();
        img.src = monsterUrls[name];
        monsterImages.set(name, img);
    }
    return monsterImages.get(name);
}

/** @type {{self: Battler, enemy: Battler, background: number, escapeAttempt: number, cutscene?: function():Promise<void>}} */
export var battleState = {
    self: {
        pokemon: null,
        trainerName: "REBECCA",
        trainer: 6,
        party: [],
        items: new Map()
    },

    enemy: {
        pokemon: null,
        trainerName: null,
        trainer: 2,
        party: [],
        items: new Map()
    },
    escapeAttempt: 0,
    background: 6
}

var fast = document.location.search.indexOf('fast') !== -1;

/**
 * @type {{resolve: function({pokemon: Pokemon, action?: string}|null):void,
 *  condition:function(Pokemon):boolean,
 *  selected: number,
 *  rightSource: number,
 *  message: string,
 *  showOnly?: boolean,
 * }}
 */
var pickPokemonInfo = null;
/**
 * @type {{resolve: function(Item|null):void, condition:function(Item):boolean, selected: number, showAll: boolean}}
 */
var pickItemInfo = null;

export function drawBattleGUI() {

    frame++;
    if (fast)
        frame += 2;
    for (var timer of timers) {
        timer.time--;
        if (fast)
            timer.time -= 10;
        if (timer.time <= 0) {
            timers.delete(timer);
            timer.resolve();
        }
    }

    ctx.save();
    ctx.clearRect(0, 0, 240, 160);

    if (pickPokemonInfo) {
        drawPickPokemon();
    } else if (pickItemInfo) {
        drawPickItem();
    } else {
        drawBattle();
    }
    // preload
    if (scene === 0 && frame === 0) {
        drawText("",0,0,ActionText);
        drawText("",0,0,HPText);
    }
    ctx.restore();
}



function drawPickPokemon() {
    ctx.drawImage(getImage("pickbg"), 0, 0);
    const main = battleState.self.pokemon || battleState.self.party[0];
    drawMainPokemon();
    var i = 0;
    for (var pokemon of battleState.self.party) {
        if (pokemon === main)
            continue;
        drawPokemonCard(pokemon, i);
        i++;

    }
    for (i; i < 5; i++) {
        ctx.drawImage(getImage("emptycard"), 88, 10 + i * 24);
    }

    drawBox(2, 0, 128, 184, 32);
    drawText(pickPokemonInfo.message, 8, 140, ActionText);
    if (!pickPokemonInfo.showOnly) {
        if (pickPokemonInfo.selected < 0)
            ctx.drawImage(getImage("cancelselected"), 184, 132);
        else
            ctx.drawImage(getImage("cancel"), 184, 134);
        drawText("CANCEL", 204, 140, PickText);
    }

}

function drawPickItem() {
    ctx.drawImage(getImage("itemsbg"), 0, 0);
    var items = pickItemInfo.showAll ? Array.from(battleState.self.items.keys()) : availableItemsToPick();
    let trueSelected = 0;
    let fakeSelected = 0;
    for (const item of items) {
        const condition = pickItemInfo.condition(item);
        if (condition && trueSelected === pickItemInfo.selected)
            break;
        if (condition)
            trueSelected++;
        fakeSelected++;
    }
    var offset = Math.max(0, Math.min(fakeSelected - 4, items.length + 1 - 9));
    for (var i = 0; i < 9 && i <= items.length - offset; i++) {
        var item = items[i + offset];
        if (item) {
            ctx.save();
            if (!pickItemInfo.condition(item))
                ctx.globalAlpha = 0.5;
            drawText(item.name, 17, 12 + 16 * i, ItemText);
            drawText('x', 199, 11 + 16 * i, ItemText)
            drawText(battleState.self.items.get(item).toString(), 222, 13 + 16 * i, ItemTextSmall, true)
            ctx.restore();
        } else {
            drawText('CANCEL', 17, 12 + 16 * i, ItemText);
        }
    }
    drawWidget(7, 8, 12 + 16 * (fakeSelected - offset));
}

function drawPokemonCard(pokemon, i) {
    ctx.save();
    ctx.translate(0, i * 24);
    if (!pickPokemonInfo.condition(pokemon))
        ctx.globalAlpha = 0.5;
    if (availablePokemonToPick()[pickPokemonInfo.selected] === pokemon)
        ctx.drawImage(getImage("pkmncardselected"), 88, 9);
    else
        ctx.drawImage(getImage("pkmncard"), 88, 10);
    ctx.drawImage(getImage("mini"), 32 * (Math.floor(frame / 8) % 2), (pokemon.id - 1) * 32, 32, 32, 84, 2, 32, 32);
    drawHPBar(pokemon, 184, 18);
    drawText(pokemon.name, 118, 14, PickText);
    drawText("℀" + pokemon.level, 128, 23, PickText);

    drawText(String(pokemon.hp), 213, 23, PickText, true);
    drawText(String(pokemon.max), 233, 23, PickText, true);
    ctx.restore();
}

function drawMainPokemon() {
    ctx.save();
    const pokemon = battleState.self.pokemon || battleState.self.party[0];
    if (!pokemon)
        return;
    if (!pickPokemonInfo.condition(pokemon))
        ctx.globalAlpha = 0.5;
    if (availablePokemonToPick()[pickPokemonInfo.selected] === pokemon)
        ctx.drawImage(getImage("mainpkmnselected"), 2, 18);
    else
        ctx.drawImage(getImage("mainpkm"), 2, 20);

    ctx.drawImage(getImage("mini"), 32*(Math.floor(frame / 8) %2), (pokemon.id - 1) * 32, 32, 32, 0, 20, 32, 32);

    drawText(pokemon.name, 32, 38, PickText);
    var str = "";
    for (var i = 0; i < 5; i++) {
        str += String.fromCharCode(i+95);
    }
    drawText("℀" + pokemon.level, 40, 47, PickText);

    drawHPBar(pokemon, 32, 59);

    drawText(String(pokemon.hp), 61, 63, PickText, true);
    drawText(String(pokemon.max), 81, 63, PickText, true);
    ctx.restore();
}

function drawBattle() {
    // drawBg();
    drawPlatforms();

    incrementInfo(showEnemyInfo);

    if (battleState.enemy.trainerName) {
        drawEnemyBalls();
        drawEnemyTrainer();
    }

    if (battleState.enemy.pokemon)
        drawEnemyPokemon();

    if (battleState.enemy.pokemon)
        drawEnemyHp();

    incrementInfo(showSelfInfo);

    // drawSelfBalls();
    if (battleState.self.pokemon)
        drawSelfHp();

    // drawSelfTrainer();
    if (battleState.self.pokemon)
        drawSelfPokemon();

    drawBox(1, 0, 112, 240, 48);
    drawBottomText();

    drawActions();

    drawLetterBox();
}

/**
 * @param {{duration: number, max: number, resolve:Function, direction: number}} info
 */
function incrementInfo(info) {
    info.duration += info.direction;
    if (fast)
        info.duration += 10 * info.direction;
    if (info.duration < 0) {
        info.duration = 0;
        info.resolve();
        info.direction = 0;
    }
    if (info.duration > info.max) {
        info.duration = info.max;
        info.resolve();
        info.direction = 0;
    }
}

/**
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{font: Font, foreground: string, background: string}} type
 * @param {boolean=} alignRight
 */
function drawText(text, x, y, type, alignRight) {
    var lines = text.split("\n");
    var line = "";
    var top = 0;
    for (var i = 0; i < lines.length; i++){
        top = y + i * 16;
        line = lines[i];
        drawLine(line, top);
    }
    return {
        measure: function (){
            // ctx.font = type.font;
            return {
                x: 2 + x + type.font.measure(text.split('\n').slice(-1)[0]),
                y: top
            };
        }
    };

    function drawLine(text, y){
        if (alignRight)
            x -= type.font.measure(text);
        ctx.save();
        ctx.shadowOffsetX = 1 * ctx.canvas.width / 240;
        ctx.shadowOffsetY = 1 * ctx.canvas.height / 160;
        ctx.shadowBlur = 1 * ctx.canvas.width / 240;
        ctx.shadowColor = type.background;
        type.font.draw(text, x, y, type.foreground);
        ctx.restore();
    }
}
function drawActions(){
    if (!menuInfo)
        return;

    switch (menuInfo.actionMenu) {
        case 0:
            drawBox(0, 120, 112, 120, 48);
            drawText("FIGHT", 136, 124, ActionText);
            drawText("RUN", 192, 140, ActionText);
            drawText("BAG", 192, 124, ActionText);
            drawWidget(2, 127+56*(menuInfo.actionSelected%2), 124+16*((menuInfo.actionSelected/2)|0));
            break;
        case 1:
            drawBox(0, 0, 112, 160, 48);
            drawBox(0, 160, 112, 80, 48);
            for (var i = 0; i < 4; i++){
                var name = battleState.self.pokemon.moves[i] ? battleState.self.pokemon.moves[i].name.toUpperCase() : "--";
                drawText(name, (i % 2) ? 88 : 16, (i < 2) ? 124 : 140, ActionTextSmall);
            }
            drawWidget(2, 7+72*(menuInfo.actionSelected%2), 124+16*((menuInfo.actionSelected/2)|0));

            drawText("PP",168,125,ActionTextSmall);
            drawText("TYPE/", 168, 141, ActionTextSmall);
            var move = battleState.self.pokemon.moves[menuInfo.actionSelected];
            drawText(move.type,191,140,ActionText);
            var pp = move.pp;
            if (battleState.self.pokemon.volatile.disabled && battleState.self.pokemon.volatile.disabled.get(move))
                drawText('DISABLED', 232, 124, ActionText, true);
            else
                drawText((pp - (battleState.self.pokemon.PP[move.name] || 0)) + "/" + pp, 232, 124, ActionText, true);
            break;
    }
}

/**
 * @type {{text: string, start: number, duration: number, confirmation:boolean, resolve: Function}}
 */
var bottomTextInfo = null;
function drawBottomText() {
    if (!bottomTextInfo)
        return;
    var text = bottomTextInfo.text;
    var time = bottomTextInfo.duration ? (frame - bottomTextInfo.start) / Math.min(60, bottomTextInfo.duration) : 1;
    if (fast)
        time = 1;
    var clippedText = text.substring(0,Math.round(time * text.length));
    var measure = drawText(clippedText, 10, 124, InvertedText).measure;
    if (clippedText && clippedText.length === text.length && bottomTextInfo.confirmation){
        var point = measure();
        var f = Math.floor(frame/8) % 2 * (Math.floor(frame/16) % 2 ? 1 : -1);
        drawWidget(0, point.x, point.y + f);
    }
    if (!bottomTextInfo.confirmation && (frame >= bottomTextInfo.start + bottomTextInfo.duration || fast))
        bottomTextInfo.resolve();
}

/**
 * @param {string} text
 */
export async function displayText(text, confirmation = false, duration = 90) {
    var resolve;
    var promise = new Promise(x => resolve = x);;
    bottomTextInfo = {
        text, start: frame, duration, confirmation, resolve
    }
    await promise;
    if (confirmation)
        clickSound();
}

function drawEnemyHp() {
    var x = 120 - calcNewFrame(showEnemyInfo, 40)*3;
    if (!battleState.enemy.trainerName)
        x = 240 - calcFrame(120, 0) * 2;
    ctx.save();
    ctx.translate(-x, 0);
    ctx.drawImage(getImage("enemyhp"), 13, 16, 100, 29);
    drawHPBar(battleState.enemy.pokemon, 52, 33);

    var suffix = "";
    drawText(battleState.enemy.pokemon.name + suffix, 20, 20, HPText);
    var level = battleState.enemy.pokemon.level.toString();
    drawText("Lv" + level, 99, 20, HPText, true);
    var status = statusForPokemon(battleState.enemy.pokemon);
    if (!status)
        ctx.drawImage(getImage("hptag"), 36, 31, 16, 7);
    else
        ctx.drawImage(getImage("status"), 0, 8*(status - 1), 20, 8, 20, 30, 20, 8);
    ctx.restore();
}

var showSelfInfo = {
    direction: 0,
    resolve: function () { },
    duration: 0,
    max: 180
}

var showEnemyInfo = {
    direction: 0,
    resolve: function () { },
    duration: 0,
    max: 120
}

var throwBallInfo = {
    resolve: function () { },
    duration: 0,
    max: 90,
    direction: 0
}

function drawSelfHp() {
    var x = 120 - calcNewFrame(showSelfInfo, 40)*3;

    var dance = 0;
    if (menuInfo)
        dance = ((frame/16)%2)|0;
    ctx.save();
    ctx.translate(x, dance);

    ctx.drawImage(getImage("selfhp"), 126, 74, 1248/12, 37);
    drawHPBar(battleState.self.pokemon, 174, 91);

    ctx.fillStyle = "#40c8f8";
    ctx.fillRect(158, 107, Math.round(64 * battleState.self.pokemon.exp / battleState.self.pokemon.nextExp), 2);
    var hp = battleState.self.pokemon.hp.toString();
    var max = battleState.self.pokemon.max.toString();

    drawText(hp + "/", 206, 96, HPText, true);
    drawText(max, 221, 96, HPText, true);
    var suffix = "";
    drawText(battleState.self.pokemon.name + suffix, 142, 78, HPText);
    var level = battleState.self.pokemon.level.toString();
    drawText("Lv" + level, 221, 78, HPText, true);
    ctx.drawImage(getImage("hptag"), 158, 89, 16, 7);
    var status = statusForPokemon(battleState.self.pokemon);
    if (status)
        ctx.drawImage(getImage("status"), 0, 8*(status - 1), 20, 8, 142, 96, 20, 8);
    ctx.restore();
}

function calcNewFrame(object, max) {
    if (!object)
        return 0;
    return Math.min(object.duration, max);
}

var flashingSelf = false;
function drawSelfPokemon() {
    if (flashingSelf && frame % 8 > 3)
        return;
    if (battleState.self.pokemon.volatile.underground || battleState.self.pokemon.volatile.upHigh)
        return;
    var dance = 0;
    if (menuInfo)
        dance = (((frame + 8)/16)%2)|0;
    var f = Math.max(showSelfInfo.duration,0);
    drawPokemon(battleState.self.pokemon.id, false, 40, 48 + dance, Math.min(f/32, 1), function (ctx){
        ctx.fillStyle = "#F6F";
        ctx.save();
        ctx.globalAlpha = Math.max(1-f/32,0);
        ctx.fillRect(0,0,64,64);
        ctx.restore();
        ctx.globalCompositeOperation = "destination-in";
    });
}

var flashingEnemy = false;
function drawEnemyPokemon(){
    if (flashingEnemy && frame % 8 > 3)
        return;
    if (battleState.enemy.pokemon.volatile.underground || battleState.enemy.pokemon.volatile.upHigh)
        return;
    var f = Math.max((calcNewFrame(showEnemyInfo, 64) - 32) / 32, 0);
    var goIn = 240;
    if (!battleState.enemy.trainerName) {
        goIn = calcFrame(120, 0) * 2;
        f = 1;
    }
    var dY = 0;
    if (throwBallInfo.duration > 65) {
        f = Math.min(f, 1 - (calcNewFrame(throwBallInfo, 90) - 65) / 25);
        dY = -64 * ( 1- f);
    }
    drawPokemon(battleState.enemy.pokemon.id, true, 144 - 240 + goIn, 8 + dY, f, function (ctx){
        ctx.fillStyle = "#F6F";
        ctx.save();
        ctx.globalAlpha = 1-f;
        ctx.fillRect(0,0,64,64);
        ctx.restore();
        ctx.globalCompositeOperation = "destination-in";
    });
}

function drawEnemyTrainer(){
    var i = battleState.enemy.trainer;
    var x = (i%5) * 64;
    var y = Math.floor(i/5) * 64;
    var goIn = calcFrame(120, 0) * 2;
    var goOut = Math.max((calcNewFrame(showEnemyInfo, 120) - 16) * 3, 0);
    ctx.drawImage(getImage("trainers"), x, y, 64, 64, 143 - 240 + goIn + goOut, 8, 64, 64);
}

function drawEnemyBalls(){
    var a = 1 - calcNewFrame(showEnemyInfo, 32)/32;
    if (!a)
        return;
    ctx.save();
    ctx.globalAlpha = a;
    for (var i = 0; i < 6; i++) {
        var x = 75 - i*10;
        var xx = -104 * (i+1) + calcFrame(13*7, 1) * 8;
        var widget = 4;
        if (i < battleState.enemy.party.length)
            widget = battleState.enemy.party[i].hp > 0 ? 3 : 5;
        drawWidget(widget, Math.min(x, xx), 31);
    }
    ctx.drawImage(getImage("arrows"),0,4,104,4,-104 + calcFrame(13,1)*8,40,104,4);
    ctx.restore();
}


var HP_COLORS = [["#58d080", "#70f8a8"], ["#c8a808", "#f8e038"], ["#a84048", "#f85838"]];
/**
 * @param {Pokemon} pokemon
 * @param {number} x
 * @param {number} y
 */
function drawHPBar(pokemon, x, y) {
    var ratio = Math.round(48 * pokemon.hp / pokemon.max);
    ratio = Math.max(0, Math.min(ratio, 48));
    var color = ratio > 24 ? HP_COLORS[0] : (ratio > 12 ? HP_COLORS[1] : HP_COLORS[2]);
    const gradient = ctx.createLinearGradient(x, y, x, y + 3);
    gradient.addColorStop(0, color[0]);
    gradient.addColorStop(1, color[1]);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, ratio, 3, 1.5);
    ctx.fill();
    // ctx.fillRect(x, y, ratio, 3);
    // ctx.fillStyle = color[1];
    // ctx.fillRect(x, y+1, ratio, 2);
}
var scene = 0;
var frame = 0;


function drawPlatforms() {
    var a = calcFrame(120, 0) * 2;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(175 + a - 240, 64, 56, 16, 0, 0, 2 * Math.PI);
    ctx.ellipse(70 + 240 - a, 120, 56, 16, 0, 0, 2 * Math.PI);
    ctx.fill();

}
function drawBg() {
    var yy = (Math.floor(battleState.background / 3))*112;
    var xx = (battleState.background % 3) * 240;
    // bg
    ctx.drawImage(getImage("bgs"), xx, yy, 2, 112, 0, 0, 240, 112);
}

function drawBox(num, x, y, w, h) {
    const scale = 12;
    var xx = num * 24 * scale;
    var yy = 0 * scale;
    var box = getImage("box");
    const tile_size = 8 * scale;
    const offset_size = 16 * scale;

    ctx.drawImage(box, xx, yy, tile_size, tile_size, x, y, 8, 8);
    ctx.drawImage(box, xx + offset_size, yy, tile_size, tile_size, x + w - 8, y, 8, 8);
    ctx.drawImage(box, xx, yy + offset_size, tile_size, tile_size, x, y + h - 8, 8, 8);
    ctx.drawImage(box, xx + offset_size, yy + offset_size, tile_size, tile_size, x + w - 8, y + h - 8, 8, 8);

    for (var i = x + 8; i < x + w - 8; i += 8) {
        ctx.drawImage(box, xx + tile_size, yy, tile_size, tile_size, i, y, 8, 8);
        ctx.drawImage(box, xx + tile_size, yy+offset_size, tile_size, tile_size, i, y+h-8, 8, 8);
    }
    for (var i = y + 8; i < y + h - 8; i += 8) {
        ctx.drawImage(box, xx, yy+tile_size, tile_size, tile_size, x, i, 8, 8);
        ctx.drawImage(box, xx + offset_size, yy + tile_size, tile_size, tile_size, x + w - 8, i, 8, 8);
    }
    for (var i = x + 8; i < x + w - 8; i += 8)
        for (var j = y + 8; j < y + h - 8; j += 8)
            ctx.drawImage(box, xx + tile_size, yy + tile_size, tile_size, tile_size, i, j, 8, 8);

}

var effectCanvas = document.createElement("canvas");
effectCanvas.width = 1024;
effectCanvas.height = 1024;
var etx = effectCanvas.getContext("2d");
etx.scale(1024/64, 1024/64);
function drawPokemon(number, front, x, y, scale, overlay) {

    // if (number >= pokemon.length || number <= 0)
    //     throw new Error("unknown pokemon" + number);
    // var yy = Math.floor((number-1) / 16);
    // var xx = (number - 1) % 16;

    ctx.save();
    ctx.translate(x+32,y+64);
    ctx.scale(scale, scale);
    etx.save();
    etx.clearRect(0,0,64,64);
    draw();
    if (overlay)
        overlay(etx);
    draw();
    etx.restore();
    ctx.drawImage(effectCanvas, -32, -64, 64, 64);
    ctx.restore();

    function draw() {
        etx.drawImage(monsterImage(front ? "ghost2" : "fish_back"), 0, 0, 64, 64);
    }
}

function drawLetterBox() {
    ctx.fillStyle = "#000";
    var a = calcFrame(160, 0)/2;
    a *= (15+a)/15;
    ctx.fillRect(0,0,240,80 - a);
    ctx.fillRect(0,80+a,240, 80 - a);
}

var images = {};
function getImage(url) {
    if (!images[url]) {
        if (!imageURLS[url])
            throw new Error("unknown image " + url);
        images[url] = new Image();
        images[url].src = imageURLS[url];
    }
    return images[url];
}
var offsets = [0];
function calcFrame(max, s){
    if (s === scene)
        return Math.min(max, frame - offsets[s]);
    return scene > s ? max : 0;
}

function bumpScene() {
    scene++;
    offsets[scene] = frame;
}

function drawWidget(num, x, y){
    const scale = 12;
    ctx.drawImage(getImage("widgets"),scale * 10*num,0,scale * 10, scale * 10,x,y,10,10);
}

/** @type {Set<{time: number, resolve: function}>} */
var timers = new Set();

export function waitFor(time) {
    var resolve;
    var promise = new Promise(x => resolve = x);
    timers.add({
        time, resolve
    });
    return promise;
}

/**
 * @param {Pokemon} pokemon
 * @param {number} amount
 */
export async function animateDamage(pokemon, amount) {
    if (!amount)
        return;

    if (amount > 0) {
        if (pokemon === battleState.self.pokemon)
            flashingSelf = true;
        else if (pokemon === battleState.enemy.pokemon)
            flashingEnemy = true;
        await waitFor(32);
        flashingSelf = false;
        flashingEnemy = false;
    }

    for (var i = 0; i < Math.abs(amount) && (amount > 0 ? pokemon.hp > 0 : pokemon.hp < pokemon.max); i++) {
        pokemon.hp -= amount > 0 ? 1 : -1;
        await waitFor(1);
    }
}

/**
 * @param {Pokemon} pokemon
 * @param {number} amount
 */
export async function animateExp(pokemon, amount) {
    await displayText(pokemon.name + ' gained\n' + amount + ' EXP!');
    const sound = playSound('exp');
    var increment = Math.floor(amount / 16);
    var speed = Math.floor(Math.log10(amount));
    for (var i = 0; i < amount && pokemon.level < 100; i++) {
        pokemon.exp += 1;
        if (!(i % speed))
            await waitFor(1);
        if (pokemon.exp >= pokemon.nextExp) {
            sound.pause();
            playSound('levelup');
            await displayText(pokemon.name + ' grew\nto level ' + (pokemon.level + 1) + '!');
            await forceLevelUp(pokemon, true);
            sound.play().catch(() => { });
        }
    }
    sound.pause();
    pokemon.exp = Math.round(pokemon.exp);
}

async function toggleSelfPokemon(value) {
    showSelfInfo.direction = value ? 1 : -1;
    var promise = /** @type {Promise<void>} */ (new Promise(x => showSelfInfo.resolve = x));
    if (value) {
        await displayText("Go! " + battleState.self.pokemon.name + "!");
    } else {
        await displayText(battleState.self.pokemon.name + "\nwas defeated!", true);
        playSound('faint');
    }
    await promise;
}

async function toggleEnemyPokemon(value) {
    showEnemyInfo.direction = value ? 1 : -1;
    var promise = /** @type {Promise<void>} */ (new Promise(x => showEnemyInfo.resolve = x));
    if (value) {
        if (battleState.enemy.trainerName)
            await displayText(battleState.enemy.trainerName + " sent \nout " + battleState.enemy.pokemon.name + "!");
        else
            showEnemyInfo.duration = showEnemyInfo.direction < 0 ? 0 : showEnemyInfo.max;
    } else {
        playSound('faint');
        await displayText(battleState.enemy.pokemon.name + "\nwas defeated!", true);
    }
    await promise;
}

/**
 * @return {Promise<boolean>}
 */
export async function startBattle() {
    // init
    frame = 0;
    scene = 0;
    showSelfInfo = {
        direction: 0,
        resolve: function () { },
        duration: 0,
        max: 120
    }

    showEnemyInfo = {
        direction: 0,
        resolve: function () { },
        duration: 0,
        max: 120
    }
    throwBallInfo = {
        resolve: function () { },
        duration: 0,
        max: 90,
        direction: 0
    };
    bottomTextInfo = null;
    pickPokemonInfo = null;
    menuInfo = null;


    battleState.escapeAttempt = 0;
    battleState.self.pokemon = battleState.self.party.find(pokemon => !!pokemon.hp);
    battleState.enemy.pokemon = battleState.enemy.party.find(pokemon => !!pokemon.hp);

    for (var pokemon of battleState.self.party)
        pokemon.volatile = {};
    for (var pokemon of battleState.enemy.party)
        pokemon.volatile = {};

    await waitFor(120);
    bumpScene();
    if (battleState.enemy.trainerName)
        await displayText(battleState.enemy.trainerName + "\nwould like to battle!", true);
    else if (definition(battleState.enemy.pokemon).zombie)
        await displayText('A crazed ' + battleState.enemy.pokemon.name + ' appeared!', true);
    else
        await displayText('A wild ' + battleState.enemy.pokemon.name + ' appeared!', true);
    await toggleEnemyPokemon(true),
    await toggleSelfPokemon(true);
    if (battleState.cutscene)
        await battleState.cutscene();
    else while (true) {
        var move = battleState.self.pokemon.volatile.move;
        if (!move) {
            const pickedOption = await showMenu();
            if (pickedOption === "capture") {
                return true;
            } else if (pickedOption === "escape") {
                const escapeSucceeded = !!battleState.enemy.trainerName || attemptEscape(battleState.self.pokemon, battleState.enemy.pokemon, ++battleState.escapeAttempt);
                if (escapeSucceeded) {
                    setTimeout(() => playSound('escape'), 200);
                    await displayText('Got away safely!');
                    return true;
                }
                await displayText('Can\'t escape!');
                move = null;
            } else {
                move = pickedOption;
            }
        }
        await turn(move, battleState.self.pokemon, battleState.enemy.pokemon);
        if (battleState.self.pokemon.hp <= 0) {
            await toggleSelfPokemon(false);
            battleState.self.pokemon = battleState.self.party.find(p => p.hp > 0);
            if (!battleState.self.pokemon) {
                await displayText(battleState.self.party[0].name + '\nloses!', true);
                await displayText('');
                return false;
            }
            await toggleSelfPokemon(true);
        }
        if (battleState.enemy.pokemon.hp <= 0) {
            await toggleEnemyPokemon(false);
            await rewardKill(battleState.self.pokemon, battleState.enemy.pokemon, !!battleState.enemy.trainerName);
            battleState.enemy.pokemon = battleState.enemy.party.find(p => p.hp > 0);
            if (!battleState.enemy.pokemon) {
                if (battleState.enemy.trainerName) {
                    await displayText(battleState.self.pokemon.name + '\nis victorious!', true);
                }

                await displayText('');
                return true;
            }
            await toggleEnemyPokemon(true);
        }
    }
}

var battleMode = false;
/**
 * @param {boolean} b
 */
export function setBattleMode(b) {
    battleMode = b;
}
/**
 * @param {function(Pokemon):boolean=} condition
 * @param {string=} message
 * @return {Promise<{pokemon: Pokemon, action?: string}>}
 */
async function pickPokemon(condition = () => true, message = "Choose a POKéMON.") {
    const beforeMode = battleMode;
    battleMode = true; 
    var resolve;
    /** @type {Promise<{pokemon: Pokemon, action?: string}>} */
    var promise = new Promise(x => resolve = x)
    pickPokemonInfo = {
        resolve: /** @type {function({pokemon: Pokemon, action?: string}|null):void} */ (resolve),
        condition,
        selected: 0,
        rightSource: 1,
        message
    };
    if (!availablePokemonToPick().length)
        pickPokemonInfo.selected = -1;
    var result = await promise;
    pickPokemonInfo = null;
    battleMode = beforeMode;
    return result;
}

/**
 * @param {function(Item):boolean} condition
 * @return {Promise<Item>}
 */
async function pickItem(condition, showAll = false) {
    const beforeMode = battleMode;
    battleMode = true; 
    var resolve;
    /** @type {Promise<Item>} */
    var promise = new Promise(x => resolve = x)
    pickItemInfo = {
        resolve: /** @type {function(Item|null):void} */ (resolve),
        condition,
        showAll,
        selected: 0
    };
    var item = await promise;
    pickItemInfo = null;
    battleMode = beforeMode;
    return item;
}

/** @type {{resolve: function(Move|"escape"|"capture"):void, actionMenu: number, actionSelected: number}} */
var menuInfo = null;
async function showMenu() {
    /** @type {function(Move|"escape"|"capture"):void} */
    var resolve;
    /** @type {Promise<Move|"escape"|"capture">} */
    var promise = new Promise(x => resolve = x);
    menuInfo = {
        actionMenu: 0,
        actionSelected: 0,
        resolve
    };
    await displayText("What will\n" + battleState.self.pokemon.name + " do?", false, 0);
    var move = await promise;
    menuInfo = null;
    return move;
}

keyManager.listenKeydown(button => {
    if (!battleMode) return;
    switch (button) {
        case 'A':
            if (bottomTextInfo) {
                if (frame - bottomTextInfo.start < 60) {
                    bottomTextInfo.start = frame - 60;
                } else {
                    bottomTextInfo.resolve();
                }
            }
            if (menuInfo && menuInfo.actionSelected === 0 && menuInfo.actionMenu === 0) {
                clickSound();
                var hasPP = battleState.self.pokemon.moves.some(move => {
                    if (battleState.self.pokemon.volatile.disabled && battleState.self.pokemon.volatile.disabled.get(move))
                        return false;
                    return (battleState.self.pokemon.PP[move.name] || 0) < move.pp;
                });
                if (!hasPP)
                    menuInfo.resolve(moveByName("Struggle"));
                else
                    menuInfo.actionMenu = 1;
            } else if (menuInfo && menuInfo.actionMenu === 1) {
                clickSound();
                var move = battleState.self.pokemon.moves[menuInfo.actionSelected];
                if ((battleState.self.pokemon.PP[move.name] || 0) >= move.pp) {
                    (async function () {
                        var tempMenu = menuInfo;
                        var tempText = bottomTextInfo;
                        menuInfo = null;
                        await displayText(move.name + '\nis out of pp!');
                        menuInfo = tempMenu;
                        bottomTextInfo = tempText;
                    })();
                } else if (battleState.self.pokemon.volatile.disabled && battleState.self.pokemon.volatile.disabled.get(move)) {
                    (async function () {
                        var tempMenu = menuInfo;
                        var tempText = bottomTextInfo;
                        menuInfo = null;
                        await displayText(move.name + '\nis disabled!');
                        menuInfo = tempMenu;
                        bottomTextInfo = tempText;
                    })();
                } else {
                    menuInfo.resolve(move);
                }
            } else if (menuInfo && menuInfo.actionMenu === 0 && menuInfo.actionSelected === 1) {
                clickSound();
                (async function () {
                    var tempMenu = menuInfo;
                    var tempText = bottomTextInfo;
                    menuInfo = null;
                    await Promise.resolve(); // prevent this key event from taking it
                    while (true) {
                        var item = await pickItem(item => !!item.heals);
                        if (!item) {
                            menuInfo = tempMenu;
                            bottomTextInfo = tempText;
                            return;
                        }
                        if (item.heals) {
                            const {pokemon} = await pickPokemon(pokemon => {
                                if (pokemon.hp <= 0)
                                    return false;
                                if (item.heals.burn && pokemon.burn)
                                    return true;
                                if (item.heals.confuse && pokemon.volatile.confused)
                                    return true;
                                if (item.heals.freeze && pokemon.freeze)
                                    return true;
                                if (item.heals.heal && pokemon.hp < pokemon.max)
                                    return true;
                                if (item.heals.paralyze && pokemon.paralyze)
                                    return true;
                                if (item.heals.poison && pokemon.poison)
                                    return true;
                                if (item.heals.sleep && pokemon.sleep)
                                    return true;
                            });
                            if (!pokemon)
                                continue;
                            await displayText(pokemon.name + ' used ' + item.name + '.');
                            if (item.heals.burn && pokemon.burn) {
                                pokemon.burn = 0;
                                await displayText(pokemon.name + ' was\ncured of it\'s burn!');
                            }
                            if (item.heals.confuse && pokemon.volatile.confused) {
                                delete pokemon.volatile.confused;
                                await displayText(pokemon.name + '\nis confused no more!');
                            }
                            if (item.heals.freeze && pokemon.freeze) {
                                pokemon.freeze = 0;
                                await displayText(pokemon.name + '\nthawed out!');
                            }
                            if (item.heals.heal && pokemon.hp < pokemon.max)
                                await animateDamage(pokemon, -item.heals.heal);
                            if (item.heals.paralyze && pokemon.paralyze) {
                                pokemon.paralyze = 0;
                                await displayText(pokemon.name + '\nis paralyzed no more!');
                            }
                            if (item.heals.poison && pokemon.poison) {
                                pokemon.poison = 0;
                                await displayText(pokemon.name + ' was\ncured of it\'s poison!');
                            }
                            if (item.heals.sleep && pokemon.sleep) {
                                pokemon.sleep = 0;
                                await displayText(pokemon.name + '\nwoke up!');
                            }
                        }
                        /** @type {"escape"|"capture"} */
                        var resolve = null;

                        var count = battleState.self.items.get(item) - 1;
                        if (count)
                            battleState.self.items.set(item, count);
                        else
                            battleState.self.items.delete(item);

                        menuInfo = tempMenu;
                        bottomTextInfo = tempText;
                        menuInfo.resolve(resolve);
                        return;
                    }
                })();
            } else if (menuInfo && menuInfo.actionMenu === 0 && menuInfo.actionSelected === 3) {
                clickSound();
                if (battleState.enemy.trainerName) {
                    (async function () {
                        var tempMenu = menuInfo;
                        var tempText = bottomTextInfo;
                        menuInfo = null;
                        await displayText('No! There\'s no running\nfrom a TRAINER battle!', true);
                        // await displayText('Can\'t escape!');
                        menuInfo = tempMenu;
                        bottomTextInfo = tempText;
                    })();
                } else {
                    menuInfo.resolve('escape');
                }
            }
            break;
        case 'B':
            if (menuInfo && menuInfo.actionMenu === 1) {
                menuInfo.actionMenu = 0;
                menuInfo.actionSelected = 0;
                clickSound();
            }
            break;
    }
    if (menuInfo) {
        var x = menuInfo.actionSelected % 2;
        var y = (menuInfo.actionSelected / 2) | 0;
        switch (button) {
            case 'Down':
                y = 1;
                break;
            case 'Up':
                y = 0;
                break;
            case 'Right':
                x = 1;
                break;
            case 'Left':
                x = 0;
                break;
        }
        var t = x + y * 2;
        const before = menuInfo.actionSelected;
        if (menuInfo.actionMenu === 1) {
            if (battleState.self.pokemon.moves[t])
                menuInfo.actionSelected = t;
        }
        else if (menuInfo.actionMenu === 0) {
            if (t === 2)
                menuInfo.actionSelected = 3;
            else
                menuInfo.actionSelected = t;
        }
        if (menuInfo.actionSelected !== before)
            clickSound();
    }
    if (pickPokemonInfo && !pickPokemonInfo.showOnly) {
        const all = availablePokemonToPick();
        switch (button) {
            case 'Right':
                if (pickPokemonInfo.selected === 0)
                    pickPokemonInfo.selected = pickPokemonInfo.rightSource;
                break;
            case 'Left':
                if (pickPokemonInfo.selected > 0) {
                    pickPokemonInfo.rightSource = pickPokemonInfo.selected;
                    pickPokemonInfo.selected = 0;
                }
                break;
            case 'Down':
                pickPokemonInfo.selected++;
                break
            case 'Up':
                pickPokemonInfo.selected--;
                break;
            case 'B':
                pickPokemonInfo.resolve({pokemon: null});
                break;
            case 'A':
                pickPokemonInfo.resolve({pokemon: all[pickPokemonInfo.selected] || null});
                break;
        }
        const before = pickPokemonInfo.selected;
        pickPokemonInfo.selected = ((pickPokemonInfo.selected + 1 + all.length + 1) % (all.length + 1)) - 1;
        if (before !== pickPokemonInfo.selected)
            clickSound();
    }
    if (pickItemInfo) {
        const all = availableItemsToPick();
        switch (button) {
            case 'Down':
                pickItemInfo.selected++;
                break;
            case 'Up':
                pickItemInfo.selected--;
                break;
            case 'B':
                pickItemInfo.resolve(null);
                break;
            case 'A':
                pickItemInfo.resolve(all[pickItemInfo.selected] || null);
                break;
        }
        const before = pickItemInfo.selected;
        pickItemInfo.selected = Math.min(Math.max(pickItemInfo.selected, 0), all.length);
        if (before !== pickItemInfo.selected)
            clickSound();
    }
});

document.addEventListener('touchstart', e => {
    if (!battleMode) return;
    if (e.target !== gamescreen) return;
    e.preventDefault();
    e.stopPropagation();
    const gr = gamescreen.getBoundingClientRect();
    const x = e.touches[0].clientX - gr.left;
    const y = e.touches[0].clientY - gr.top;
    const mx = gr.width / 2;
    const my = gr.height / 2;
    if (Math.abs(mx - x) > Math.abs(my - y)) {
        if (x > mx) {
            gamescreen.dispatchEvent(new KeyboardEvent('keydown', {
                code: 'ArrowRight',
                bubbles: true
            }))
        } else {
            gamescreen.dispatchEvent(new KeyboardEvent('keydown', {
                code: 'ArrowLeft',
                bubbles: true
            }))
        }
    } else {
        if (y > my) {
            gamescreen.dispatchEvent(new KeyboardEvent('keydown', {
                code: 'ArrowDown',
                bubbles: true
            }))
        } else {
            gamescreen.dispatchEvent(new KeyboardEvent('keydown', {
                code: 'ArrowUp',
                bubbles: true
            }))
        }
    }
}, {passive: false});

/**
 * @return {Array<Pokemon>}
 */
function availablePokemonToPick() {
    var all = [];
    if (pickPokemonInfo.condition(battleState.self.pokemon))
        all.push(battleState.self.pokemon);
    for (var pokemon of battleState.self.party) {
        if (!pickPokemonInfo.condition(pokemon))
            continue;
        if (pokemon === battleState.self.pokemon)
            continue;
        all.push(pokemon);
    }
    return all;
}

/**
 * @return {Array<Item>}
 */
function availableItemsToPick() {
    return Array.from(battleState.self.items.keys()).filter(pickItemInfo.condition);
}


class Font {
    /**
     * @param {string} imageHref
     * @param {string} jsonHref
     * @param {number} height
     */
    constructor(imageHref, jsonHref, height) {
        this._height = height;
        // this._image = new Image();
        // /** @type {Map<string, HTMLCanvasElement>} */
        // this._canvas = new Map();
        // this._image.src = imageHref;
        // this._info = null;
        // this._loaded = false;
        // this._image.onload = () => {
        //     this._loaded = true;
        // };
        // fetch(jsonHref).then(data => data.json()).then(info => this._info = info);
    }

    /**
     * @param {string} text
     * @return {number}
     */
    measure(text) {
        ctx.save();
        this._setFont();
        const width = ctx.measureText(text).width;
        ctx.restore();
        return width;
    }

    _setFont() {
        ctx.font = this._height + 'px sans-serif';
    }

    /**
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {string} color
     * @return {number}
     */
    draw(text, x, y, color) {
        ctx.save();
        this._setFont();
        ctx.fillStyle = color;
        const width = this.measure(text);
        ctx.fillText(text, x, y + this._height * 0.8);
        ctx.restore();
        return width;
    }
}
const smallFont = new Font(
    undefined,
    undefined, 8);
const normalFont = new Font(
    undefined,
    undefined, 11);

var ActionText = {
    font: normalFont,
    foreground: "#484848",
    background: "#d0d0c8"
}
var ActionTextSmall = {
    font: smallFont,
    foreground: "#484848",
    background: "#d0d0c8"
}

var InvertedText = {
    font: normalFont,
    foreground: "#f8f8f8",
    background: "#685870"
}

var HPText = {
    font: smallFont,
    foreground: "#404040",
    background: "#d8d0b0"
}

var PickText = {
    font: smallFont,
    foreground: "#F8F8F8",
    background: "#707070"
}

var ItemText = {
    font: normalFont,
    foreground: '#606060',
    background: '#d0d0c8'
}

var ItemTextSmall = {
    font: smallFont,
    foreground: '#606060',
    background: '#d0d0c8'
}
