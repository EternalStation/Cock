export const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Audio State
let isBgmPlaying = false;
let isMenuBgmPlaying = false;

// Master Gains
let masterMusicGain: GainNode | null = null;
let masterSfxGain: GainNode | null = null;
let musicVolume = 0.5;
let sfxVolume = 0.5;
let savedMusicVolume = 0.5; // For restoring after ducking

// Simple BGM System - Single looping track
let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

// Menu BGM System
let menuBgmBuffer: AudioBuffer | null = null;
let menuBgmSource: AudioBufferSourceNode | null = null;
let menuBgmGain: GainNode | null = null;

// Shoot System
let shootBuffer: AudioBuffer | null = null;
let currentShootSource: AudioBufferSourceNode | null = null;

export function setMusicVolume(vol: number) {
    musicVolume = Math.max(0, Math.min(1, vol));
    savedMusicVolume = musicVolume;
    if (bgmGain) {
        bgmGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    }
    if (masterMusicGain) {
        masterMusicGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    }
}

// Duck volume to 70% for stats menu
export function duckMusic() {
    const duckedVolume = savedMusicVolume * 0.7;
    if (bgmGain) {
        bgmGain.gain.linearRampToValueAtTime(duckedVolume, audioCtx.currentTime + 0.1);
    }
}

// Restore volume to previous setting
export function restoreMusic() {
    if (bgmGain) {
        bgmGain.gain.linearRampToValueAtTime(savedMusicVolume, audioCtx.currentTime + 0.1);
    }
}

// Pause music (for ESC menu)
export function pauseMusic() {
    if (audioCtx.state === 'running') {
        audioCtx.suspend();
    }
}

// Resume music (from ESC menu)
export function resumeMusic() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function setSfxVolume(vol: number) {
    sfxVolume = Math.max(0, Math.min(1, vol));
    if (masterSfxGain) {
        masterSfxGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
    }
}

export function getMusicVolume(): number {
    return musicVolume;
}

export function getSfxVolume(): number {
    return sfxVolume;
}


export async function startBGM() {
    stopMenuMusic();
    if (isBgmPlaying) return;
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => { });
    }

    // Init Master Gains if needed
    if (!masterMusicGain) {
        masterMusicGain = audioCtx.createGain();
        masterMusicGain.gain.value = musicVolume;
        masterMusicGain.connect(audioCtx.destination);
    }

    if (!masterSfxGain) {
        masterSfxGain = audioCtx.createGain();
        masterSfxGain.gain.value = sfxVolume;
        masterSfxGain.connect(audioCtx.destination);
    }

    isBgmPlaying = true;

    // Load background music
    if (!bgmBuffer) {
        try {
            const response = await fetch('/Background.mp3');
            const arrayBuffer = await response.arrayBuffer();
            bgmBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Failed to load BGM:", e);
        }
    }

    if (bgmBuffer) {
        playBgmLoop();
    }

    // Load Shoot Ding
    if (!shootBuffer) {
        try {
            const response = await fetch('/audio/neon_laser_shoot.wav');
            const arrayBuffer = await response.arrayBuffer();
            shootBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`Failed to load shoot ding:`, e);
        }
    }
}

function playBgmLoop() {
    if (!bgmBuffer || !isBgmPlaying) return;

    if (bgmSource) {
        try { bgmSource.stop(); } catch (e) { }
    }

    bgmSource = audioCtx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true; // Loop the entire track

    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = savedMusicVolume;

    bgmSource.connect(bgmGain);
    bgmGain.connect(masterMusicGain!);

    bgmSource.start(0);
}

// No longer needed - kept for compatibility
export function updateBGMPhase(_gameTime: number) {
    // Music just loops continuously, no phase changes
}

export function stopBGM() {
    isBgmPlaying = false;
    if (bgmSource) {
        try { bgmSource.stop(); } catch (e) { }
        bgmSource = null;
    }
}

export async function startMenuMusic() {
    if (isMenuBgmPlaying) return;

    // Try to resume if suspended (might need interaction)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    // Init Master Gains if needed
    if (!masterMusicGain) {
        masterMusicGain = audioCtx.createGain();
        masterMusicGain.gain.value = musicVolume;
        masterMusicGain.connect(audioCtx.destination);
    }

    if (!masterSfxGain) {
        masterSfxGain = audioCtx.createGain();
        masterSfxGain.gain.value = sfxVolume;
        masterSfxGain.connect(audioCtx.destination);
    }

    isMenuBgmPlaying = true;

    // Load menu music
    if (!menuBgmBuffer) {
        try {
            const response = await fetch('/MenuTheme.mp3');
            const arrayBuffer = await response.arrayBuffer();
            menuBgmBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Failed to load Menu BGM:", e);
        }
    }

    if (menuBgmBuffer) {
        playMenuBgmLoop();
    }
}

function playMenuBgmLoop() {
    if (!menuBgmBuffer || !isMenuBgmPlaying) return;

    if (menuBgmSource) {
        try { menuBgmSource.stop(); } catch (e) { }
    }

    menuBgmSource = audioCtx.createBufferSource();
    menuBgmSource.buffer = menuBgmBuffer;
    menuBgmSource.loop = true;

    menuBgmGain = audioCtx.createGain();
    menuBgmGain.gain.value = savedMusicVolume;

    menuBgmSource.connect(menuBgmGain);
    menuBgmGain.connect(masterMusicGain!);

    menuBgmSource.start(0);
}

export function stopMenuMusic() {
    isMenuBgmPlaying = false;
    if (menuBgmSource) {
        try { menuBgmSource.stop(); } catch (e) { }
        menuBgmSource = null;
    }
}

export function playShootDing() {
    if (audioCtx.state === 'suspended' || !shootBuffer) return;

    // Instant kill previous to avoid mud
    if (currentShootSource) {
        try { currentShootSource.stop(); } catch (e) { }
    }

    currentShootSource = audioCtx.createBufferSource();
    currentShootSource.buffer = shootBuffer;

    // 0.95 - 1.05x random pitch
    currentShootSource.playbackRate.value = 0.95 + Math.random() * 0.1;

    const gain = audioCtx.createGain();
    gain.gain.value = sfxVolume * 0.4;

    currentShootSource.connect(gain);
    gain.connect(masterSfxGain!);
    currentShootSource.start();
}

export async function playUpgradeSfx(rarityId: string) {
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!masterSfxGain) {
        masterSfxGain = audioCtx.createGain();
        masterSfxGain.gain.value = sfxVolume;
        masterSfxGain.connect(audioCtx.destination);
    }

    console.log(`[Audio] Selection SFX: ${rarityId} (Context: ${audioCtx.state})`);
    const t = audioCtx.currentTime + 0.05; // 50ms scheduling buffer
    const tone = (freq: number, type: OscillatorType, dur: number, vol: number, startTime: number) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(vol, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        osc.connect(g); g.connect(masterSfxGain!);
        osc.start(startTime); osc.stop(startTime + dur);
    };

    // Rarity frequency map
    const rarityMap: Record<string, number> = {
        'junk': 110,
        'broken': 146.83,
        'common': 220,
        'uncommon': 293.66,
        'rare': 440,
        'epic': 587.33,
        'legendary': 880,
        'mythical': 1174.66,
        'ancient': 1760,
        'divine': 220 // Base for divine chord
    };

    const baseFreq = rarityMap[rarityId] || 440;

    if (rarityId === 'divine') {
        // Massive Divine Impact
        const chord = [55, 110, 220, 330, 440, 554, 659, 880, 1320]; // Rich A major stack
        chord.forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = i < 3 ? 'sawtooth' : 'sine';
            osc.frequency.setValueAtTime(f, t);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, t);
            filter.frequency.exponentialRampToValueAtTime(100, t + 2.0);

            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.2, t + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

            osc.connect(filter);
            filter.connect(g);
            g.connect(masterSfxGain!);
            osc.start(t);
            osc.stop(t + 4.0);
        });

        // Divine "Aaaa" Choir Formants stack
        [600, 1040, 2250, 2450].forEach(f => {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const g = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220 + Math.random() * 2, t);
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(f, t);
            filter.Q.value = 10;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.5);
            g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
            osc.connect(filter); filter.connect(g); g.connect(masterSfxGain!);
            osc.start(t); osc.stop(t + 3.5);
        });

    } else {
        // Universal Indexed Pluck
        const isLow = ['junk', 'broken', 'common'].includes(rarityId);
        const type = isLow ? 'sawtooth' : 'triangle';
        const decay = isLow ? 0.4 : 1.0;
        const volume = isLow ? 0.15 : 0.25;

        // Main Pluck
        tone(baseFreq, type, decay, volume, t);

        // Harmonic / Octave
        if (!isLow) {
            tone(baseFreq * 2, 'sine', decay * 1.5, volume * 0.5, t + 0.05);
            tone(baseFreq * 1.5, 'sine', decay * 1.2, volume * 0.3, t + 0.1);
        } else {
            // "Dirty" subtle noise for junk/broken
            tone(baseFreq * 0.5, 'sawtooth', 0.2, 0.05, t);
        }
    }
}

export function playSfx(type: 'shoot' | 'hit' | 'level' | 'hurt' | 'boss-fire' | 'rare-spawn' | 'rare-despawn' | 'rare-kill') {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
        return;
    }
    // Ensure SFX Gain exists
    if (!masterSfxGain) {
        masterSfxGain = audioCtx.createGain();
        masterSfxGain.gain.value = sfxVolume;
        masterSfxGain.connect(audioCtx.destination);
    }

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g);
    g.connect(masterSfxGain);

    if (type === 'shoot') {
        // More pleasant shoot: lighter square or triangle with fast decay
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);
        g.gain.setValueAtTime(0.25, t); // BOOSTED from 0.08
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
    }
    else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    }
    else if (type === 'hurt') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.2);
        g.gain.setValueAtTime(0.15, t);
        g.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
    }
    else if (type === 'boss-fire') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.5);
        g.gain.setValueAtTime(0.1, t);
        osc.start(t);
        osc.stop(t + 0.5);
    }
    else if (type === 'level') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(880, t + 0.5);
        g.gain.setValueAtTime(0.1, t);
        osc.start(t);
        osc.stop(t + 0.5);
    }
    else if (type === 'rare-spawn') {
        // Mystery "Radar" Pulse
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1); // Up-chirp
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.5); // Down-settle

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.05); // Attack
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.0); // Long decay

        // Add a second harmonic for "chorus" feel
        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(605, t); // Slightly detuned
        osc2.connect(g2);
        g2.connect(masterSfxGain);
        g2.gain.setValueAtTime(0, t);
        g2.gain.linearRampToValueAtTime(0.1, t + 0.05);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        osc2.start(t);
        osc2.stop(t + 1.0);

        osc.start(t);
        osc.stop(t + 1.0);
    }
    else if (type === 'rare-despawn') {
        // Disappointing "Inverse" Pulse
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.3); // Down-slide

        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        osc2.type = 'sawtooth'; // Harsher
        osc2.frequency.setValueAtTime(805, t);
        osc2.connect(g2);
        g2.connect(masterSfxGain);
        g2.gain.setValueAtTime(0.05, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc2.start(t);
        osc2.stop(t + 0.5);

        osc.start(t);
        osc.stop(t + 0.5);
    }
    else if (type === 'rare-kill') {
        // "Jackpot" Major Arpeggio (C-E-G-C)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const toneOsc = audioCtx.createOscillator();
            const toneGain = audioCtx.createGain();

            toneOsc.type = i === 3 ? 'sine' : 'triangle'; // Top note pure, others bright
            toneOsc.frequency.setValueAtTime(freq, t + i * 0.08); // Arpeggiated

            toneGain.gain.setValueAtTime(0, t + i * 0.08);
            toneGain.gain.linearRampToValueAtTime(0.1, t + i * 0.08 + 0.05);
            toneGain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.6); // Ring out

            toneOsc.connect(toneGain);
            toneGain.connect(masterSfxGain!);

            toneOsc.start(t + i * 0.08);
            toneOsc.stop(t + i * 0.08 + 0.8);
        });

        // Bed of "Sparkles" (High pitch randoms)
        for (let k = 0; k < 5; k++) {
            const sparkOsc = audioCtx.createOscillator();
            const sparkGain = audioCtx.createGain();
            sparkOsc.type = 'sine';
            sparkOsc.frequency.setValueAtTime(1200 + Math.random() * 800, t + (k * 0.1));

            sparkGain.gain.setValueAtTime(0.05, t + (k * 0.1));
            sparkGain.gain.exponentialRampToValueAtTime(0.001, t + (k * 0.1) + 0.3);

            sparkOsc.connect(sparkGain);
            sparkGain.connect(masterSfxGain!);
            sparkOsc.start(t + (k * 0.1));
            sparkOsc.stop(t + (k * 0.1) + 0.3);
        }
    }
}
