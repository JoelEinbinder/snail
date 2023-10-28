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
    var s = new Audio();
    s.src = "sfx/" + sound + ".mp3";
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
    playSound('firered_0005');
}
