import { useRef, useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { createInitialGameState } from '../logic/GameState';
import { updatePlayer } from '../logic/PlayerLogic';
import { updateEnemies } from '../logic/EnemyLogic';
import { updateProjectiles, spawnBullet } from '../logic/ProjectileLogic';
import { updateBossBehavior } from '../logic/BossLogic';
import { spawnUpgrades, applyUpgrade } from '../logic/UpgradeLogic';
import { calcStat } from '../logic/MathUtils';
import { playSfx, startBGM, updateBGMPhase, duckMusic, restoreMusic, pauseMusic, resumeMusic, startBossAmbience, stopBossAmbience } from '../logic/AudioLogic';
import { updateParticles } from '../logic/ParticleLogic';

export function useGameLoop(gameStarted: boolean) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameState = useRef<GameState>(createInitialGameState());
    const requestRef = useRef<number>(0);
    const keys = useRef<Record<string, boolean>>({});
    // Fixed Time Step Logic
    const lastTimeRef = useRef<number>(0);
    const accRef = useRef<number>(0);

    // Pause state refs (so loop can check current state without closure issues)
    const showStatsRef = useRef(false);
    const showSettingsRef = useRef(false);
    const upgradeChoicesRef = useRef<UpgradeChoice[] | null>(null);

    // React state for UI overlays
    const [uiState, setUiState] = useState<number>(0);
    const [upgradeChoices, setUpgradeChoices] = useState<UpgradeChoice[] | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [bossWarning, setBossWarning] = useState<number | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Sync refs with state
    showStatsRef.current = showStats;
    showSettingsRef.current = showSettings;
    upgradeChoicesRef.current = upgradeChoices;

    // Input Handling
    useEffect(() => {
        if (!gameStarted) return; // Ignore inputs if game hasn't started

        const handleDown = (e: KeyboardEvent) => {
            console.log('Key down:', e.key);
            startBGM();
            if (e.key === 'Escape') {
                setShowSettings(p => !p);
            }
            // Handle C key for stats toggle before guard clause
            if (e.key.toLowerCase() === 'c') {
                setShowStats(prev => !prev);
            }
            if (showSettings || showStats) return;

            keys.current[e.key.toLowerCase()] = true;
        };
        const handleUp = (e: KeyboardEvent) => keys.current[e.key.toLowerCase()] = false;

        // Cheat Code Buffer
        let cheatBuffer = '';
        const handleCheat = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            cheatBuffer += key;
            if (cheatBuffer.length > 10) cheatBuffer = cheatBuffer.slice(-10);

            if (cheatBuffer.endsWith('die')) {
                setGameOver(true);
                playSfx('hurt');
                cheatBuffer = ''; // Reset
            }


        };

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        window.addEventListener('keydown', handleCheat);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
            window.removeEventListener('keydown', handleCheat);
        };
    }, [showSettings, showStats, gameStarted]); // Re-bind if blocking state changes

    const restartGame = () => {
        gameState.current = createInitialGameState();
        setGameOver(false);
        setUpgradeChoices(null);
        setBossWarning(null);
        setShowSettings(false);
    };

    const handleUpgradeSelect = (choice: UpgradeChoice) => {
        applyUpgrade(gameState.current, choice);
        setUpgradeChoices(null);
    };

    // Game Loop
    useEffect(() => {
        let cancelled = false;
        lastTimeRef.current = performance.now();
        const loop = () => {
            if (cancelled) return;
            const now = performance.now();
            const dt = (now - lastTimeRef.current) / 1000;
            lastTimeRef.current = now;

            // Cap dt to prevent spiral of death if tab inactive
            const safeDt = Math.min(dt, 0.1);

            const state = gameState.current;

            // If game hasn't started, just render one frame and pause logic
            if (!gameStarted) {
                // Drawing (Always draw to ensure canvas isn't blank if needed, though MainMenu covers it)
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) {
                    // renderGame(ctx, state); // Optional: render static frame or nothing
                }
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            // Pausing Logic (check refs for current values)
            const isMenuOpen = showStatsRef.current || showSettingsRef.current || upgradeChoicesRef.current !== null;
            state.isPaused = isMenuOpen;

            // Music volume control based on menu state
            const inStats = showStatsRef.current;
            const inSettings = showSettingsRef.current;

            if (inSettings) {
                pauseMusic(); // ESC menu stops music
            } else if (inStats) {
                resumeMusic(); // Ensure music is playing
                duckMusic(); // Duck to 70% for stats menu only
            } else {
                resumeMusic(); // Ensure music is playing
                restoreMusic(); // Restore full volume (including when in upgrade menu)
            }

            // Only accumulate time if not paused
            if (state.isPaused || state.gameOver) {
                accRef.current = 0; // Prevent "fast-forward" catch-up when unpausing
            } else {
                accRef.current += safeDt;
            }

            const FIXED_STEP = 1 / 60;

            if (!state.isPaused && !state.gameOver) {
                // Fixed Update Step
                while (accRef.current >= FIXED_STEP) {
                    // Update Logic
                    updatePlayer(state, keys.current);

                    // Trigger Spawn Sound if just starting (approx check)
                    // We need a better flag for "sound played", but since timer counts down...
                    // Let's add a "hasPlayedSpawnSound" to state or just check if timer is > 0.9 and we haven't played it?
                    // Simpler: Just rely on the fact that restartGame resets state
                    if (state.spawnTimer > 0.95 && !state.hasPlayedSpawnSound) {
                        playSfx('spawn');
                        state.hasPlayedSpawnSound = true;
                    }

                    state.camera.x = state.player.x;
                    state.camera.y = state.player.y;

                    updateEnemies(state);

                    updateProjectiles(state, (event) => {
                        if (event === 'level_up') {
                            const choices = spawnUpgrades(state, false);
                            setUpgradeChoices(choices);
                            playSfx('level');
                        }
                        if (event === 'boss_kill') {
                            state.bossKills = (state.bossKills || 0) + 1;
                            const choices = spawnUpgrades(state, true);
                            setUpgradeChoices(choices);
                            playSfx('level');
                        }
                        if (event === 'game_over') {
                            setGameOver(true);
                            playSfx('hurt');
                        }
                    });

                    state.enemies.forEach(e => {
                        updateBossBehavior(e);
                    });

                    // Shooting Logic
                    const { player } = state;
                    const atkScore = Math.min(9999, calcStat(player.atk));
                    const fireDelay = 200000 / atkScore;

                    if (Date.now() - player.lastShot > fireDelay && state.spawnTimer <= 0) {
                        const d = calcStat(player.dmg);
                        for (let i = 0; i < player.multi; i++) {
                            const offset = (i - (player.multi - 1) / 2) * 0.15;
                            spawnBullet(state, player.x, player.y, player.targetAngle, d, player.pierce, offset);
                        }
                        player.lastShot = Date.now();
                        playSfx('shoot');
                    }

                    state.drones.forEach((d, i) => {
                        d.a += 0.05;
                        d.x = player.x + Math.cos(d.a + (i * 2)) * 60;
                        d.y = player.y + Math.sin(d.a + (i * 2)) * 60;
                        if (Date.now() - d.last > 800) {
                            const droneDmgMult = player.droneCount > 3 ? Math.pow(2, player.droneCount - 3) : 1;
                            spawnBullet(state, d.x, d.y, player.targetAngle, calcStat(player.dmg) * droneDmgMult, player.pierce);
                            d.last = Date.now();
                        }
                    });

                    updateParticles(state);
                    state.gameTime += FIXED_STEP;

                    // Boss Warning
                    const timeLeft = state.nextBossSpawnTime - state.gameTime;
                    if (timeLeft <= 10 && timeLeft > 0) setBossWarning(timeLeft);
                    else setBossWarning(null);

                    // Smooth Boss Presence Transition
                    const activeBoss = state.enemies.some(e => e.boss);
                    const targetPresence = activeBoss ? 1.0 : 0.0;
                    // Lerp approx 0.01 per frame (60fps) -> ~2-3 seconds transition
                    // Lerp approx 0.01 per frame (60fps) -> ~2-3 seconds transition
                    state.bossPresence = state.bossPresence + (targetPresence - state.bossPresence) * 0.02;

                    // Boss Ambience Trigger
                    if (activeBoss) {
                        startBossAmbience();
                    } else {
                        // Stop immediately when dead (AudioLogic handles fade out)
                        stopBossAmbience();
                    }

                    accRef.current -= FIXED_STEP;
                }
            }

            // Update BGM phase (runs even when paused)
            updateBGMPhase(state.gameTime);

            // Drawing (Always draw)
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                renderGame(ctx, state);
            }

            // Force Re-render for UI updates
            setUiState(prev => prev + 1);
            requestRef.current = requestAnimationFrame(loop);
        };

        // Start Loop
        requestRef.current = requestAnimationFrame(loop);

        return () => {
            cancelled = true;
            cancelAnimationFrame(requestRef.current!);
        };
    }, [gameStarted]); // Run when gameStarted changes

    return {
        canvasRef,
        gameState: gameState.current,
        upgradeChoices,
        handleUpgradeSelect,
        gameOver,
        restartGame,
        bossWarning,
        showStats,
        setShowStats,
        showSettings,
        setShowSettings,
        uiState
    };
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
    const { width, height } = ctx.canvas;
    const { camera, player, enemies, bullets, enemyBullets, drones, particles } = state;

    // Clear - Reverted to Deep Slate per feedback, but kept dark
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Zoom / Camera Logic
    // 120% Vision = 0.8 scale roughly (1 / 1.25)
    // To keep player centered:
    // 1. Move origin to center of screen
    ctx.translate(width / 2, height / 2);
    // 2. Apply Scale - Zoom scale reduced by 15% (0.68 -> 0.58)
    ctx.scale(0.58, 0.58);
    // 3. Move origin to camera position (which follows player)
    ctx.translate(-camera.x, -camera.y);

    // Screen Shake Logic (Spawn OR Boss)
    // Use smoothed bossPresence for shake intensity
    if (state.spawnTimer > 0 || state.bossPresence > 0.01) {
        let intensity = 0;
        if (state.spawnTimer > 0) intensity += state.spawnTimer * 5;

        // Boss Shake: Scale with presence
        // "increased screen shake"
        if (state.bossPresence > 0) {
            intensity += 3 * state.bossPresence; // Constant rumble

            // Random intense shake
            if (Math.random() < 0.05 * state.bossPresence) {
                intensity += 15 * state.bossPresence; // Harder hits
            }
        }

        const shakeX = (Math.random() - 0.5) * intensity;
        const shakeY = (Math.random() - 0.5) * intensity;
        ctx.translate(shakeX, shakeY);
    }

    // Global Darken for Boss (Background dim)
    if (state.bossPresence > 0.01) {
        // "slowly darken"
        ctx.fillStyle = `rgba(0, 0, 0, ${state.bossPresence * 0.7})`; // Max 0.7 opacity
        // Draw centered on camera to cover the viewport
        const vW = width / 0.58; // Reverse scale
        const vH = height / 0.58;
        ctx.fillRect(camera.x - vW, camera.y - vH, vW * 2, vH * 2);
    }

    // --- VOID HEX VORTEX BACKGROUND ---

    // Constants
    const deepHexSize = 300;

    // Helper: Draw Hex Grid
    const drawHexGrid = (
        gridSize: number,
        color: string,
        alpha: number,
        lineWidth: number = 1
    ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;

        // Calculate visible bounds
        // (Parallax offset logic removed)

        // Viewport correction (we are currently centered and scaled)
        // We need to determine the world coordinates covered by the screen
        const scale = 0.58;
        const vW = width / scale;
        const vH = height / scale;

        const cX = camera.x; // Always center grid generation on camera to ensure infinite coverage
        const cY = camera.y;

        // Hex Grid Math
        const r = gridSize;
        const w = Math.sqrt(3) * r;
        const vDist = 1.5 * r;

        const startCol = Math.floor((cX - vW / 2) / w) - 1;
        const endCol = Math.floor((cX + vW / 2) / w) + 2;
        const startRow = Math.floor((cY - vH / 2) / vDist) - 1;
        const endRow = Math.floor((cY + vH / 2) / vDist) + 2;

        for (let row = startRow; row <= endRow; row++) {
            const rowOffset = (row % 2) !== 0 ? w / 2 : 0;
            const y = row * vDist;
            for (let col = startCol; col <= endCol; col++) {
                const x = col * w + rowOffset;

                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const ang = Math.PI / 3 * i + Math.PI / 6;
                    const hx = x + r * Math.cos(ang);
                    const hy = y + r * Math.sin(ang);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }

        ctx.restore();
    };

    // Boss Intensity (0.0 to 1.0)
    // bossIntensity logic removed as unused

    // 1. STABLE DEEP LAYER (Background)
    // "Faint, static honeycomb grid... fades to pure black at edges"
    ctx.shadowBlur = 0;
    drawHexGrid(deepHexSize, '#1e293b', 0.1, 2); // Darker slate, lower alpha

    // Void Rifts (Deep Layer) - REMOVED
    // "No remove those balck holes"

    // 2. MOVING MID LAYER (Parallax) - REMOVED
    // "remove that second hexogon grid"

    // 3. MID-GROUND FOG (Atmosphere)
    // Draw some "cloud" particles that swirl
    // 3. MID-GROUND FOG (Atmosphere) - REMOVED per user request ("remove 5 big circles")
    /*
    ctx.save();
    // ... fog code removed ...
    ctx.restore();
    */
    // (Keeping placeholder comment or just removing)


    // Particles moved to post-enemy render for smoke occlusion

    // Player - Honeycomb Hexagon
    ctx.save();
    ctx.translate(player.x, player.y);

    const cellSize = 15.7; // Increased by 40% from 11.2

    // Helper function to draw a hexagon
    const drawHexagon = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            // Flat-topped: Vertices at 0, 60, 120...
            const angle = (Math.PI / 3) * i;
            const px = x + r * Math.cos(angle);
            const py = y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    };

    // Setup style for honeycomb cells
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5; // Slightly thicker for visibility
    ctx.setLineDash([]); // Ensure solid lines
    ctx.lineCap = 'round'; // Smooth corners
    ctx.lineJoin = 'round'; // Smooth joins to prevent "dots" at sharp corners
    ctx.shadowBlur = 0; // Removed aura per user request

    // Draw 7 connected honeycomb cells
    if (state.spawnTimer > 0) {
        // Animation Logic
        const progress = Math.max(0, 1.0 - state.spawnTimer);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic Out Easing

        // Center Cell - Scales up
        const scale = Math.min(1, ease * 1.5);
        if (scale > 0) {
            ctx.save();
            ctx.scale(scale, scale);
            drawHexagon(0, 0, cellSize);
            ctx.restore();
        }

        // Surrounding Cells - Fly in
        const finalDist = cellSize * Math.sqrt(3);
        const startDist = finalDist * 5; // Start further away
        const currentDist = startDist - (startDist - finalDist) * ease;

        ctx.globalAlpha = Math.min(1, ease * 2);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const cx = currentDist * Math.cos(angle);
            const cy = currentDist * Math.sin(angle);
            drawHexagon(cx, cy, cellSize);
        }
        ctx.globalAlpha = 1;
    } else {
        // Normal Static Draw
        // Center cell
        drawHexagon(0, 0, cellSize);

        // 6 surrounding cells
        const cellDistance = cellSize * Math.sqrt(3);
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const cx = cellDistance * Math.cos(angle);
            const cy = cellDistance * Math.sin(angle);
            drawHexagon(cx, cy, cellSize);
        }
    }

    ctx.restore();

    // Drones
    drones.forEach(d => {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Snitch Trails (Breadcrumbs) - Draw BEHIND enemies
    enemies.forEach(e => {
        if (e.longTrail && e.longTrail.length > 1) {
            ctx.save();
            ctx.strokeStyle = '#FFD700'; // Gold
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.8;

            ctx.beginPath();
            e.longTrail.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            ctx.restore();
        }
    });

    // Enemies
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);

        // Apply Rotation
        if (e.rotationPhase) {
            ctx.rotate(e.rotationPhase);
        }

        // Pulse Animation (Breathing effect) - Scale 1.0 to 1.05
        const pulse = 1.0 + (Math.sin(e.pulsePhase || 0) * 0.05);
        ctx.scale(pulse, pulse);

        // Colors from Palette
        let coreColor = e.palette[0];
        let innerColor = e.palette[1];
        let outerColor = e.palette[2];

        // Pentagon Pink Pulse
        if (e.shape === 'pentagon') {
            const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2; // 0 to 1
            // Pulse Pink at peak
            if (pVal > 0.6) {
                outerColor = '#FF60E6'; // Neon Pink
                innerColor = '#FF90EE'; // Lighter Pink
            }
        }

        // --- BOSS CHAOS CALCS ---
        let chaosLevel = 0;
        if (e.boss) {
            const minutes = state.gameTime / 60;
            chaosLevel = Math.min(1, Math.max(0, (minutes - 2) / 10)); // 0.0 - 1.0
        }

        // GLITCH EFFECT (Fake Snitch OR Boss)
        if ((e.glitchPhase && e.glitchPhase > 0) || e.boss) {
            const intensity = e.boss ? chaosLevel * 15 : 10;
            const flickerChance = e.boss ? 0.8 - (chaosLevel * 0.2) : 0.8; // Boss flickers more at high chaos

            // Random Jitter
            if (e.boss && Math.random() < chaosLevel * 0.3) {
                const jitter = (Math.random() - 0.5) * intensity;
                ctx.translate(jitter, -jitter);
            } else if (e.glitchPhase && !e.boss) {
                // Snitch glitch
                const jitter = (Math.random() - 0.5) * 10;
                ctx.translate(jitter, -jitter);
            }

            if (Math.random() > flickerChance) {
                ctx.globalAlpha = 0.6; // Flicker opacity
            }
        }

        // Shapes Helper
        const drawShape = (size: number, isWarpedLimit: boolean = false) => {
            ctx.beginPath();

            // BOSS WARP/WOBBLE (Hologram instability)
            // We'll use a custom vertex transformer if it's a boss
            const warpAmp = isWarpedLimit && e.boss ? (0.1 + chaosLevel * 0.2) * size : 0;
            // Helper to warp a point
            const wp = (px: number, py: number) => {
                if (warpAmp === 0) return { x: px, y: py };
                // Sin wave distort based on Y + Time
                const offset = Math.sin((py / size) * 4 + (state.gameTime * 10)) * warpAmp;
                return { x: px + offset, y: py };
            };

            if (e.shape === 'circle') {
                if (warpAmp > 0) {
                    // Manual circle for warp
                    for (let i = 0; i <= 20; i++) {
                        const theta = (i / 20) * Math.PI * 2;
                        const px = Math.cos(theta) * size;
                        const py = Math.sin(theta) * size;
                        const p = wp(px, py);
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    }
                } else {
                    ctx.arc(0, 0, size, 0, Math.PI * 2);
                }
            } else if (e.shape === 'minion') {
                // Chevron / Dart Shape (Stealth Bomber look)
                // "Unique, not a star"
                // Vertices relative to center (0,0)
                // 1. Tip
                const p1 = wp(size, 0);
                // 2. Bottom Wing
                const p2 = wp(-size, size * 0.7);
                // 3. Rear Indent
                const p3 = wp(-size * 0.3, 0);
                // 4. Top Wing
                const p4 = wp(-size, -size * 0.7);

                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
            } else if (e.shape === 'triangle') {
                const p1 = wp(0, -size);
                const p2 = wp(size * 0.866, size * 0.5);
                const p3 = wp(-size * 0.866, size * 0.5);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
            } else if (e.shape === 'square') {
                const p1 = wp(-size, -size);
                const p2 = wp(size, -size);
                const p3 = wp(size, size);
                const p4 = wp(-size, size);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
            } else if (e.shape === 'diamond') {
                const p1 = wp(0, -size * 1.3);
                const p2 = wp(size, 0);
                const p3 = wp(0, size * 1.3);
                const p4 = wp(-size, 0);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.closePath();
            } else if (e.shape === 'pentagon') {
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    const p = wp(px, py);
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
            } else if (e.shape === 'snitch') {
                // "North Star" / Spiked Star Shape

                // 8 Points total: 4 Long (Cardinal), 4 Short (Diagonal)
                // We'll construct it as a single polygon for clean stroking/filling

                const longR = size * 1.5;
                const shortR = size * 0.5;
                const innerR = size * 0.2; // Indent between points

                // 16 vertices (8 tips + 8 valleys)
                const step = (Math.PI * 2) / 16;
                // Rotate -PI/2 to align first Long point to Top (North)
                const startAngle = -Math.PI / 2;

                for (let i = 0; i < 16; i++) {
                    const angle = startAngle + (i * step);

                    // i=0 (Tip Long), i=1 (Valley), i=2 (Tip Short), i=3 (Valley)...
                    const isTip = i % 2 === 0;
                    let r = innerR; // Default to valley

                    if (isTip) {
                        const tipIndex = i / 2; // 0..7
                        // Evens (0,2,4,6) are Cardinal -> Long
                        // Odds (1,3,5,7) are Diagonal -> Short
                        r = (tipIndex % 2 === 0) ? longR : shortR;
                    }

                    // Warp support
                    const px = Math.cos(angle) * r;
                    const py = Math.sin(angle) * r;
                    const p = wp(px, py);

                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
            }
        };

        // --- VISUAL LAYER SYSTEM ---

        // BOSS: TRAOLS (Glitchy After-images) rendered BEFORE main body
        if (e.boss && e.trails) {
            e.trails.forEach(t => {
                ctx.save();
                // Trails are static in world space, but we are inside ctx.translate(e.x, e.y)
                // So we need to undo that or just calculate relative
                // Easier: Just draw them relative to current 0,0 if we stored relative? 
                // Logic in EnemyLogic stored absolute X/Y. 
                // So we need to undo the translate:
                ctx.translate(-e.x, -e.y); // Back to world 0,0
                ctx.translate(t.x, t.y); // To trail pos

                ctx.scale(pulse, pulse); // Match scale
                ctx.rotate(t.rotation); // Match rotation

                ctx.strokeStyle = outerColor;
                ctx.lineWidth = 1;
                ctx.globalAlpha = t.alpha * 0.5;
                drawShape(e.size, false); // No warp on trails for perf/readability
                ctx.stroke();
                ctx.restore();
            });
        }

        // 0. BOSS ONLY: PULSING RED SECONDARY OUTLINE (#FF0000)
        // "ALWAYS pulsing red secondary outline (#FF0000, thick, 1px flicker)"
        if (e.boss) {
            const flicker = Math.random() > 0.5 ? 1 : 0.8;
            const redAlpha = (0.6 + Math.sin(state.gameTime * 10) * 0.4) * flicker;
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3; // Thick
            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = 20; // Big red glow
            ctx.globalAlpha = redAlpha;
            drawShape(e.size * 1.25, true); // Larger than outer (1.1)
            ctx.stroke();
            ctx.globalAlpha = 1.0; // Reset
        }

        // 1. OUTLINE (Thin glowing ring)
        // Offset 5-10% outward -> size * 1.1
        ctx.strokeStyle = outerColor;
        ctx.lineWidth = 1.5;
        // Subtle glow bloom
        ctx.shadowBlur = 8;
        ctx.shadowColor = outerColor;
        drawShape(e.size * 1.1, true); // Warp active for boss
        ctx.stroke();

        // 2. INSIDE LAYER (Remaining 50%)
        // Semi-transparent glow overlay
        // We draw the full size shape, but the Core will cover the inner 50%
        ctx.fillStyle = innerColor;
        // Adjust alpha manually since we only have hex codes
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0; // No blur on fill to save perf/clean look
        drawShape(e.size, true);
        ctx.fill();

        // BOSS: BLACK VOIDS (Cracks in Inside Layer)
        if (e.boss) {
            ctx.save();
            ctx.clip(); // Clip to the shape just drawn

            ctx.fillStyle = '#000000';
            ctx.globalAlpha = 0.8;
            // Random cracks/voids
            // We use seeded random based on ID + crackPhase to make them "flicker"
            const seed = Math.floor(state.gameTime * 10); // 10Hz flicker
            // Draw 2-3 random polygons
            const crackCount = 2 + Math.floor(chaosLevel * 4);
            const r = (n: number) => {
                const sin = Math.sin(n + e.id);
                return sin - Math.floor(sin);
            };

            for (let k = 0; k < crackCount; k++) {
                ctx.beginPath();
                // Random center inside
                const cx = (r(seed + k) - 0.5) * e.size * 1.2;
                const cy = (r(seed + k + 100) - 0.5) * e.size * 1.2;
                // Draw jagged shard
                for (let v = 0; v < 4; v++) {
                    const ang = v * (Math.PI / 2) + r(k + v);
                    const dist = 5 + r(k * v) * 15;
                    const px = cx + Math.cos(ang) * dist;
                    const py = cy + Math.sin(ang) * dist;
                    if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.fill();
            }
            ctx.restore();
            ctx.globalAlpha = 0.4; // Restore for next fills if any
        }

        // 3. CORE (Innermost 50%)
        // Solid bright fill
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 15; // Bright bloom for core
        ctx.shadowColor = coreColor;
        drawShape(e.size * 0.5, true);
        ctx.fill();

        // BOSS ONLY: CHAOS PARTICLES (Orbiting Shards)
        if (e.boss) {
            const particleCount = 5 + Math.floor(chaosLevel * 95); // 5 to 100
            const orbitSpeed = state.gameTime * (2 + chaosLevel * 4); // Fast orbit

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#880000'; // Dark Red

            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + orbitSpeed;
                // Variable radius
                const dist = (e.size * 1.5) + Math.sin(i + orbitSpeed) * 10 + (Math.random() * chaosLevel * 20);

                const px = Math.cos(angle) * dist;
                const py = Math.sin(angle) * dist;

                ctx.beginPath();
                // Tiny shard
                ctx.rect(px, py, 2 + chaosLevel * 2, 2 + chaosLevel * 2);
                ctx.fill();
            }
        }

        // BOSS SCANLINES (Overlay)
        if (e.boss) {
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = 0.1 + (chaosLevel * 0.2);
            // Draw horizontal lines across the shape
            const lines = 10;
            for (let i = 0; i < lines; i++) {
                const yPos = -e.size + (i / lines) * (e.size * 2);
                if (Math.sin(yPos + state.gameTime * 20) > 0) { // Moving scanbar
                    ctx.fillRect(-e.size, yPos, e.size * 2, 2);
                }
            }
        }

        ctx.restore(); // Undo scale/rotation/translate(jitter)

        // Boss HP Bar
        if (e.boss) {
            ctx.save();
            ctx.translate(e.x, e.y);
            const barWidth = 80;
            const barHeight = 8;
            const yOffset = -e.size - 25;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

            // Health
            const hpPercent = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = '#ef4444'; // Red
            ctx.fillRect(-barWidth / 2 + 1, yOffset + 1, (barWidth - 2) * hpPercent, barHeight - 2);

            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(-barWidth / 2, yOffset, barWidth, barHeight);

            ctx.restore();
        }
    });

    // Particles (Rendered AFTER enemies to allow smoke to hide them)
    particles.forEach(p => {
        // Opacity logic: Keep fully opaque until life is low?
        // User requested "100% opacity nothing though it should be seen"
        // Standard fade: ctx.globalAlpha = p.life; (life is > 1 usually?)
        // Wait, p.life in logic is 30-90. globalAlpha expects 0-1.
        // If p.life > 1, globalAlpha = 1 (clamped usually? No canvas acts weird with >1? No it clamps).
        // Let's ensure it stays 1.0 mostly.
        ctx.globalAlpha = Math.min(1, p.life / 20);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Bullets
    ctx.fillStyle = '#22d3ee'; // Player Color (Cyan)
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 5;
    bullets.forEach(b => {
        // Mask: Only draw if outside player radius to avoid cluttering the center
        const dist = Math.hypot(b.x - player.x, b.y - player.y);
        if (dist < 43) return; // Player radius is approx 43 (15.7 + 27.2)

        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); // Increased size slightly to match new scale
        ctx.fill();
    });

    // Enemy Bullets
    // Enemy Bullets
    enemyBullets.forEach(b => {
        const bulletColor = b.color || '#f87171';
        ctx.fillStyle = bulletColor;
        ctx.shadowColor = bulletColor;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 4. FOREGROUND VIGNETTE (Screen Space Overlay)
    // "Dimmer screen edges (vignette: 50% darker tones at borders, gradient to clear center)"

    ctx.restore(); // Restore to Screen Space for UI/Overlay effects

    // 5. OFF-SCREEN BOSS INDICATORS
    enemies.forEach(e => {
        if (!e.boss) return;

        // Calculate Screen Coordinates
        // Global Transform was: translate(w/2, h/2) -> scale(0.58) -> translate(-camX, -camY)
        // ScreenX = (WorldX - CamX) * Scale + W/2
        const scale = 0.58;
        const screenX = (e.x - camera.x) * scale + width / 2;
        const screenY = (e.y - camera.y) * scale + height / 2;

        const margin = 50;
        const isOffScreen = screenX < -margin || screenX > width + margin ||
            screenY < -margin || screenY > height + margin;

        if (isOffScreen) {
            // Calculate angle properties
            const angle = Math.atan2(screenY - height / 2, screenX - width / 2);

            // Clamp to screen edges
            const padding = 40;
            let tx = width / 2 + Math.cos(angle) * (width); // Far out
            let ty = height / 2 + Math.sin(angle) * (width); // Far out

            // Liang-Barsky line clipping or simple edge clamping?
            // Simple edge clamping for center-to-target ray:
            // Find intersection with box (padding, padding, width-padding, height-padding)

            // X-intersections
            const x1 = padding;
            const x2 = width - padding;
            // Y-intersections
            const y1 = padding;
            const y2 = height - padding;

            // Slope
            const m = Math.tan(angle);

            // Check X edges
            if (screenX < width / 2) {
                // Left
                tx = x1;
                ty = height / 2 + (x1 - width / 2) * m;
            } else {
                // Right
                tx = x2;
                ty = height / 2 + (x2 - width / 2) * m;
            }

            // Check if that Y is valid, if not clamp to Y
            if (ty < y1) {
                ty = y1;
                tx = width / 2 + (y1 - height / 2) / m;
            } else if (ty > y2) {
                ty = y2;
                tx = width / 2 + (y2 - height / 2) / m;
            }

            // Draw Skull Icon
            ctx.save();
            ctx.translate(tx, ty);
            // No rotation for icon itself, it stays upright or rotates? 
            // Often off-screen icons don't rotate with angle, but the position indicates direction.
            // Let's keep it upright for readability.

            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;

            // Skull Cranium
            ctx.beginPath();
            ctx.arc(0, -2, 12, 0, Math.PI * 2);
            ctx.fill();

            // Skull Jaw
            ctx.fillRect(-6, 6, 12, 8);

            // Eyes (Clear/Black)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-4, -2, 3, 0, Math.PI * 2);
            ctx.arc(4, -2, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'source-over';
            ctx.restore();

            ctx.restore();
        }
    });

    // 4. STRONG VIGNETTE (Fog of War)
    // "remove fog... see vingier darker corners... enemies slowly appear"
    // We achieve this by a strong radial gradient to black.
    const drawVignette = () => {
        const cx = width / 2;
        const cy = height / 2;
        // Radius: Cover most of screen but ensure corners are black
        const radius = Math.max(width, height) * 0.75;

        const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
        // Clear center (Visibility Circle)
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        // Soft edge start
        grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
        // SOLID BLACK EDGES - Hides enemies
        grad.addColorStop(1, 'rgba(0, 0, 0, 1.0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Boss Fog Thickening
        if (state.bossPresence > 0.01) {
            ctx.fillStyle = `rgba(20, 0, 0, ${state.bossPresence * 0.2})`; // Red tint overlay scaling
            ctx.fillRect(0, 0, width, height);

            // Darken Screen (Dimmer)
            ctx.fillStyle = `rgba(0, 0, 0, ${state.bossPresence * 0.5})`; // 50% Black overlay at max
            ctx.fillRect(0, 0, width, height);
        }
    };

    drawVignette();
}
