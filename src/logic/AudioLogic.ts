export const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Audio State
let isBgmPlaying = false;

// Master Gains
let masterMusicGain: GainNode | null = null;
let masterSfxGain: GainNode | null = null;
let musicVolume = 0.5;
let sfxVolume = 0.5;
let savedMusicVolume = 0.5; // For restoring after ducking

export const getMusicVolume = () => musicVolume;
export const getSfxVolume = () => sfxVolume;

// Simple BGM System - Single looping track
let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

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

export async function startBGM() {
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
            const response = await fetch('/audio/pleasant_neon_ding.wav');
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

export function playSfx(type: 'shoot' | 'hit' | 'level' | 'hurt' | 'boss-fire' | 'rare-spawn' | 'rare-kill' | 'rare-despawn' | 'spawn' | 'smoke-puff') {
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
        // Procedural shoot handled by Loop system now
        return;
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
        // Alert Sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.1);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);
        g.gain.setValueAtTime(0.1, t);
        g.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    }
    else if (type === 'rare-kill') {
        // Jackpot Sound
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1100, t + 0.1);
        osc.frequency.setValueAtTime(1320, t + 0.2);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t);
        osc.stop(t + 0.6);
    }
    else if (type === 'rare-despawn') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.5);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
    }
    else if (type === 'spawn') {
        // Player Start Sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 1.0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.1);
        g.gain.linearRampToValueAtTime(0, t + 1.0);
        osc.start(t);
        osc.stop(t + 1.0);
    }
    else if (type === 'smoke-puff') {
        // White Noise Burst for Smoke Screen
        // Using a buffer with random noise for simplicity if we want detailed texture
        // But for quick synthesis, many short oscillators or just a filtered noise buffer
        // Let's use a low pitched noise burst if possible, or a cluster of low Saws

        // Simulating noise with rapid frequency modulation or just a cluster
        const count = 5;
        for (let i = 0; i < count; i++) {
            const noiseOsc = audioCtx.createOscillator();
            const noiseGain = audioCtx.createGain();
            noiseOsc.type = 'sawtooth';
            // Random low frequencies
            noiseOsc.frequency.setValueAtTime(50 + Math.random() * 100, t);
            noiseOsc.frequency.exponentialRampToValueAtTime(10, t + 0.5); // Pitch Drop

            noiseGain.gain.setValueAtTime(0.05, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

            noiseOsc.connect(noiseGain);
            noiseGain.connect(masterSfxGain);
            noiseOsc.start(t);
            noiseOsc.stop(t + 0.5);
        }
    }
}

export const startMenuMusic = startBGM;
