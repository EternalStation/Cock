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

// Boss Ambience System
let bossAmbienceOsc: OscillatorNode | null = null;
let bossAmbienceGain: GainNode | null = null;
let isBossAmbiencePlaying = false;


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

export function startBossAmbience() {
    if (isBossAmbiencePlaying) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    // Ensure SFX Gain exists
    if (!masterSfxGain) {
        masterSfxGain = audioCtx.createGain();
        masterSfxGain.gain.value = sfxVolume;
        masterSfxGain.connect(audioCtx.destination);
    }

    isBossAmbiencePlaying = true;
    const t = audioCtx.currentTime;

    // Create deep drone
    bossAmbienceOsc = audioCtx.createOscillator();
    bossAmbienceGain = audioCtx.createGain();

    // Pulse low pitch (e.g. 50Hz to 60Hz slow modulation)
    bossAmbienceOsc.type = 'sawtooth';
    bossAmbienceOsc.frequency.setValueAtTime(55, t);

    // LFO for pitch instability
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.5; // Slow wobble
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 5; // +/- 5Hz
    lfo.connect(lfoGain);
    lfoGain.connect(bossAmbienceOsc.frequency);
    lfo.start(t);

    // Lowpass filter to muffle it (make it background)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    bossAmbienceGain.gain.setValueAtTime(0, t);
    bossAmbienceGain.gain.linearRampToValueAtTime(0.3, t + 2.0); // Slow fade in

    bossAmbienceOsc.connect(filter);
    filter.connect(bossAmbienceGain);
    bossAmbienceGain.connect(masterSfxGain);

    bossAmbienceOsc.start(t);
}

export function stopBossAmbience() {
    if (!isBossAmbiencePlaying || !bossAmbienceGain) return;

    isBossAmbiencePlaying = false;
    const t = audioCtx.currentTime;

    // Slow fade out
    bossAmbienceGain.gain.cancelScheduledValues(t);
    bossAmbienceGain.gain.setValueAtTime(bossAmbienceGain.gain.value, t);
    bossAmbienceGain.gain.linearRampToValueAtTime(0, t + 2.0);

    const oldOsc = bossAmbienceOsc;
    const oldGain = bossAmbienceGain; // capture closure

    setTimeout(() => {
        if (oldOsc) {
            try { oldOsc.stop(); } catch (e) { }
        }
        // Cleanup happens naturally via GC once stopped and disconnected
    }, 2100);

    bossAmbienceOsc = null;
    bossAmbienceGain = null;
}

export function playShootDing() {
    if (audioCtx.state === 'suspended') return;

    const t = audioCtx.currentTime;

    // "Cosmic Photon" - Sci-fi, laser-like, but smooth
    // Lowered pitch variant (Octave down)

    // 1. The Core Beam (Sine Sweep)
    const osc1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    osc1.type = 'sine';
    // Start mid, drop low
    osc1.frequency.setValueAtTime(750, t);
    osc1.frequency.exponentialRampToValueAtTime(150, t + 0.15);

    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(sfxVolume * 0.25, t + 0.01);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc1.connect(g1);
    g1.connect(masterSfxGain!);
    osc1.start(t);
    osc1.stop(t + 0.15);

    // 2. The Energy Trail (Triangle Detune)
    const osc2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(760, t); // Slight detune start
    osc2.frequency.exponentialRampToValueAtTime(300, t + 0.2); // Slower drop

    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(sfxVolume * 0.15, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc2.connect(g2);
    g2.connect(masterSfxGain!);
    osc2.start(t);
    osc2.stop(t + 0.2);
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
        playShootDing();
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
        g.gain.setValueAtTime(0.15, t); // Increased by 50% from 0.1
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
        // VOID Cosmic Collapse - "The Connection"
        // Deep, heavy impact with a metallic snap

        // 1. Deep Sub-Bass Swell (The Void Opening = 30-60Hz)
        const osc1 = audioCtx.createOscillator();
        const g1 = audioCtx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(40, t);
        osc1.frequency.linearRampToValueAtTime(60, t + 0.8); // Rising tension

        g1.gain.setValueAtTime(0, t);
        g1.gain.linearRampToValueAtTime(0.4, t + 0.2);
        g1.gain.linearRampToValueAtTime(0, t + 1.0); // Cut before snap

        osc1.connect(g1);
        g1.connect(masterSfxGain);
        osc1.start(t);
        osc1.stop(t + 1.0);

        // 2. High Ethereal Sweep (The Energy Gathering)
        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        const filter2 = audioCtx.createBiquadFilter();

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(200, t);

        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(200, t);
        filter2.frequency.exponentialRampToValueAtTime(2000, t + 0.9); // Open filter
        filter2.Q.value = 10; // Resonant peak

        g2.gain.setValueAtTime(0, t);
        g2.gain.linearRampToValueAtTime(0.08, t + 0.5);
        g2.gain.linearRampToValueAtTime(0, t + 0.9);

        osc2.connect(filter2);
        filter2.connect(g2);
        g2.connect(masterSfxGain);
        osc2.start(t);
        osc2.stop(t + 1.0);

        // 3. The "Snap" (Connection Made)
        // Sharp metallic connect sound at t + 0.9
        const snapOsc = audioCtx.createOscillator();
        const snapGain = audioCtx.createGain();
        const snapFilter = audioCtx.createBiquadFilter();

        snapOsc.type = 'sawtooth';
        snapOsc.frequency.setValueAtTime(1200, t + 0.9);
        snapOsc.frequency.exponentialRampToValueAtTime(100, t + 1.0); // Rapid drop

        snapFilter.type = 'highpass';
        snapFilter.frequency.value = 500; // Remove mud

        snapGain.gain.setValueAtTime(0, t + 0.9);
        snapGain.gain.linearRampToValueAtTime(0.3, t + 0.92);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

        snapOsc.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(masterSfxGain);
        snapOsc.start(t + 0.9);
        snapOsc.stop(t + 1.2);
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
