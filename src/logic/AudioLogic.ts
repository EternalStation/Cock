import {
    audioCtx,
    getMusicVolume,
    getSfxVolume,
    setMusicVolume as setBaseMusicVolume,
    setSfxVolume as setBaseSfxVolume,
    getSfxGain,
    initMasterGains,
    masterMusicGain
} from './AudioBase';
import { loadSfxAssets } from './SfxLogic';

export { audioCtx, getMusicVolume, getSfxVolume, getSfxGain };

// Audio State
let isBgmPlaying = false;
let savedMusicVolume = 0.425; // For restoring after ducking

// Simple BGM System - Single looping track
let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;

// Boss Ambience System
let bossAmbienceOsc: OscillatorNode | null = null;
let bossAmbienceGain: GainNode | null = null;
let isBossAmbiencePlaying = false;

export function setMusicVolume(vol: number) {
    setBaseMusicVolume(vol);
    savedMusicVolume = vol;
    if (bgmGain) {
        bgmGain.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
}

export function setSfxVolume(vol: number) {
    setBaseSfxVolume(vol);
}

// Duck volume by 15% for stats menu / matrix
export function duckMusic() {
    const duckedVolume = savedMusicVolume * 0.85; // 15% reduction
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

export async function startBGM(arenaId: number = 0) {
    if (isBgmPlaying) return;
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => { });
    }

    // Init Master Gains if needed
    initMasterGains();

    isBgmPlaying = true;
    await switchBGM(arenaId);

    // Load SFX Assets
    await loadSfxAssets();
}

const BGM_TRACKS: Record<number, string> = {
    0: '/audio/EconomicArenaBackground.mp3',
    1: '/audio/CombatArenaBackground.mp3',
    2: '/audio/DefensiveArenaBackgound.mp3'
};

let currentTrackId: number | null = null;

export async function switchBGM(arenaId: number) {
    if (currentTrackId === arenaId && bgmSource) return;

    if (bgmSource) {
        // Fade out
        const fadeOutTime = 0.5;
        if (bgmGain) {
            bgmGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeOutTime);
        }
        const oldSource = bgmSource;
        setTimeout(() => {
            try { oldSource.stop(); } catch (e) { }
        }, fadeOutTime * 1000 + 100);
    }

    currentTrackId = arenaId;
    const trackUrl = BGM_TRACKS[arenaId] || BGM_TRACKS[0];

    try {
        const response = await fetch(trackUrl);
        const arrayBuffer = await response.arrayBuffer();
        bgmBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        playBgmLoop();
    } catch (e) {
        console.error(`Failed to load BGM track ${trackUrl}:`, e);
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
    const masterSfxGainRef = getSfxGain();

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
    bossAmbienceGain.connect(masterSfxGainRef);

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


    setTimeout(() => {
        if (oldOsc) {
            try { oldOsc.stop(); } catch (e) { }
        }
    }, 2100);

    bossAmbienceOsc = null;
    bossAmbienceGain = null;
}

// Portal Ambience System
let portalAmbienceOscs: OscillatorNode[] = [];
let portalAmbienceGain: GainNode | null = null;
let isPortalAmbiencePlaying = false;

export function startPortalAmbience() {
    if (isPortalAmbiencePlaying) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    const masterSfxGainRef = getSfxGain();

    isPortalAmbiencePlaying = true;
    const t = audioCtx.currentTime;

    portalAmbienceGain = audioCtx.createGain();
    portalAmbienceGain.gain.value = 0;
    portalAmbienceGain.gain.linearRampToValueAtTime(0.2, t + 1.0); // Fade in
    portalAmbienceGain.connect(masterSfxGainRef);

    // Shimmering Cluster (High Pitch)
    const freqs = [880, 1108, 1320, 1760]; // A5, C#6, E6, A6
    portalAmbienceOscs = freqs.map((f, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;

        // Detune LFO
        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = 4 + Math.random() * 2; // Fast shimmer
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 15;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.detune);
        lfo.start(t);

        const oscGain = audioCtx.createGain();
        oscGain.gain.value = 1 / freqs.length;
        osc.connect(oscGain);
        oscGain.connect(portalAmbienceGain!);
        osc.start(t);
        return osc;
    });
}

export function stopPortalAmbience() {
    if (!isPortalAmbiencePlaying || !portalAmbienceGain) return;

    isPortalAmbiencePlaying = false;
    const t = audioCtx.currentTime;

    // Fade out
    portalAmbienceGain.gain.cancelScheduledValues(t);
    portalAmbienceGain.gain.setValueAtTime(portalAmbienceGain.gain.value, t);
    portalAmbienceGain.gain.linearRampToValueAtTime(0, t + 0.5);

    setTimeout(() => {
        portalAmbienceOscs.forEach(o => {
            try { o.stop(); } catch (e) { }
        });
        portalAmbienceOscs = [];
    }, 600);
}

export function stopAllLoops() {
    stopBossAmbience();
    stopPortalAmbience();
    // Assuming we also want to stop any skill loops if they were exported/tracked globally
    // For now, Boss and Portal are the main "stuck" culprits
}

export { playShootDing, playUpgradeSfx, playSfx } from './SfxLogic';
export type { SfxType } from './SfxLogic';

export const startMenuMusic = startBGM;
