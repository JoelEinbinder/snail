import levelup from './sfx/levelup.mp3'
import click from './sfx/click.mp3'
import exp from './sfx/exp.mp3'
import faint from './sfx/faint.mp3'
import escape from './sfx/escape.mp3'
import hit_super from './sfx/hit_super.mp3'
import hit_regular from './sfx/hit_regular.mp3'
import hit_weak from './sfx/hit_weak.mp3'
import poison from './sfx/poison.mp3'
const soundURLS = {
    levelup,
    click,
    exp,
    faint,
    escape,
    hit_super,
    hit_regular,
    hit_weak,
    poison,
};
var NUM_CHANNELS = 4;
/** @type {{[key: string]: ReturnType<typeof loadSound>}} */
var sounds = {};
export function playSound(sound) {
    if (!sounds[sound])
        loadSound(sound);
    const audio = sounds[sound].play();
    return audio;
}

function loadSound(sound) {
    if (!soundURLS[sound])
        throw new Error(`Sound ${sound} not found`);
    var s = new Audio();
    s.src = soundURLS[sound];
    s.preload = "auto";
    var channels = [s];
    for (var i = 0; i < NUM_CHANNELS - 1; i++)
        channels.push(/** @type {HTMLAudioElement} */ (s.cloneNode()));
    var index = 0;
    return sounds[sound] = {
        play: function () {
            const audio = channels[index];
            audio.currentTime = 0;
            audio.play().catch(() => {});
            index++;
            index %= NUM_CHANNELS;
            return audio;
        },
        stop() {
            for (const audio of channels)
                audio.pause();
        }
    }
}


export function clickSound() {
    playSound('click');
}
