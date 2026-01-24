import { useRef, useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { createInitialGameState } from '../logic/GameState';
import { updatePlayer } from '../logic/PlayerLogic';
import { updateEnemies, spawnRareEnemy, spawnEnemy } from '../logic/EnemyLogic';
import { updateProjectiles, spawnBullet } from '../logic/ProjectileLogic';
import { updateBossBehavior } from '../logic/BossLogic';
import { spawnUpgrades, applyUpgrade } from '../logic/UpgradeLogic';
import { calcStat } from '../logic/MathUtils';
import { playSfx, startBGM, updateBGMPhase, duckMusic, restoreMusic, pauseMusic, resumeMusic, startBossAmbience, stopBossAmbience } from '../logic/AudioLogic';
import { updateParticles } from '../logic/ParticleLogic';
import { ARENA_CENTERS, ARENA_RADIUS } from '../logic/MapLogic';

export function useGameLoop(gameStarted: boolean) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameState = useRef<GameState>(createInitialGameState());
    const requestRef = useRef<number>(0);
    const keys = useRef<Record<string, boolean>>({});
    // Fixed Time Step Logic
    const lastTimeRef = useRef<number>(0);
    const accRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);

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
            // Handle C key for stats toggle
            if (e.key.toLowerCase() === 'c') {
                setShowStats(prev => !prev);
            }

            // Track keys regardless of UI state so they don't get 'stuck' if held down while closing menu
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

            if (cheatBuffer.endsWith('sni')) {
                spawnRareEnemy(gameState.current);
                cheatBuffer = '';
            }

            if (cheatBuffer.endsWith('dia')) {
                // Spawn 15 diamond enemies around the player
                const player = gameState.current.player;
                for (let i = 0; i < 15; i++) {
                    const angle = (i / 15) * Math.PI * 2;
                    const dist = 300 + Math.random() * 200;
                    spawnEnemy(gameState.current, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 'diamond');
                }
                cheatBuffer = '';
            }

            if (cheatBuffer.endsWith('pen')) {
                // Spawn 5 pentagons around the player
                const player = gameState.current.player;
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2;
                    const dist = 400 + Math.random() * 100;
                    spawnEnemy(gameState.current, player.x + Math.cos(angle) * dist, player.y + Math.sin(angle) * dist, 'pentagon');
                }
                cheatBuffer = '';
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
                    const eventHandler = (event: string, _data?: any) => {
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
                        if (event === 'player_hit') {
                            // Already handled by component side flashing or explosion logic
                        }
                    };

                    updatePlayer(state, keys.current, eventHandler);

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

                    updateEnemies(state, eventHandler);

                    updateProjectiles(state, eventHandler);

                    // --- COMBAT CLEANUP ---
                    state.enemies = state.enemies.filter(e => !e.dead);

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
                try {
                    renderGame(ctx, state);
                } catch (e) {
                    console.error("Render Error:", e);
                }
            }

            // Force Re-render for UI updates (Throttled to ~15 FPS)
            frameCountRef.current++;
            if (frameCountRef.current % 4 === 0) {
                setUiState(prev => prev + 1);
            }
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

    try {
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

        // Helper: Draw Hex Grid
        const drawHexGrid = (
            gridSize: number,
            color: string,
            alpha: number,
            lineWidth: number = 1
        ) => {
            const r = gridSize;
            const h = Math.sqrt(3) * r;
            const hDist = 1.5 * r;

            const scale = 0.58;
            const vW = width / scale;
            const vH = height / scale;
            const cX = camera.x;
            const cY = camera.y;

            const startCol = Math.floor((cX - vW / 2) / hDist) - 1;
            const endCol = Math.floor((cX + vW / 2) / hDist) + 2;
            const startRow = Math.floor((cY - vH / 2) / h) - 1;
            const endRow = Math.floor((cY + vH / 2) / h) + 2;

            // 1. Draw Grid Layer with Clipping
            ctx.save();

            // Define Clipping Mask for Arenas
            ctx.beginPath();
            ARENA_CENTERS.forEach(c => {
                for (let i = 0; i < 6; i++) {
                    const ang = Math.PI / 3 * i;
                    const hx = c.x + ARENA_RADIUS * Math.cos(ang);
                    const hy = c.y + ARENA_RADIUS * Math.sin(ang);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
            });
            ctx.clip();

            // Style for connected grid
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.globalAlpha = alpha;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            for (let col = startCol; col <= endCol; col++) {
                const colOffset = (col % 2) !== 0 ? h / 2 : 0;
                const x = col * hDist;
                for (let row = startRow; row <= endRow; row++) {
                    const y = row * h + colOffset;
                    for (let i = 0; i < 6; i++) {
                        const ang = Math.PI / 3 * i;
                        const hx = x + r * Math.cos(ang);
                        const hy = y + r * Math.sin(ang);
                        if (i === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                }
            }
            ctx.stroke();
            ctx.restore();

            // 2. Draw Arena Boarders (Thick Lines) - Drawn on top
            ctx.save();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 30;
            ctx.globalAlpha = 0.3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ARENA_CENTERS.forEach(c => {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const ang = Math.PI / 3 * i;
                    const hx = c.x + ARENA_RADIUS * Math.cos(ang);
                    const hy = c.y + ARENA_RADIUS * Math.sin(ang);
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
            });
            ctx.restore();
        };

        // 1. STABLE LAYER (Background)
        drawHexGrid(200, '#1e293b', 0.25, 2);

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


        // Player Bullets (Drawn Under Player)
        bullets.forEach(b => {
            ctx.fillStyle = '#22d3ee'; // Cyan (Match Player)
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        });

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
            ctx.fill(); // Opaque mask to hide projectiles underneath
            ctx.stroke();
        };

        // Setup style for honeycomb cells
        ctx.strokeStyle = '#22d3ee';
        ctx.fillStyle = '#020617'; // Match Background (Opaque)
        ctx.lineWidth = 2.5; // Slightly thicker for visibility
        ctx.setLineDash([]); // Ensure solid lines
        ctx.lineCap = 'round'; // Smooth corners
        ctx.lineJoin = 'round'; // Smooth joins to prevent "dots" at sharp corners

        // Persistent Cyan Glow (Model Light Emission)
        ctx.strokeStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';

        // Cyan Glow - Only during 3s spawn animation
        ctx.strokeStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';

        if (state.spawnTimer > 0) {
            // Intense energy materialization during spawn
            ctx.shadowBlur = 30 * (state.spawnTimer / 3.0);
        } else {
            // No bloom after animation ends
            ctx.shadowBlur = 0;
        }

        // Draw 7 connected honeycomb cells
        if (state.spawnTimer > 0) {
            // Animation Logic
            const progress = Math.max(0, 3.0 - state.spawnTimer) / 3.0; // 0 to 1 over 3s
            const ease = 1 - Math.pow(1 - progress, 3); // Cubic Out Easing
            const spin = (1.0 - ease) * Math.PI * 4; // Extra spins at start

            ctx.rotate(spin);

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

        // Stun VFX (Electricity)
        if (player.stunnedUntil && Date.now() < player.stunnedUntil) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.strokeStyle = '#00FFFF'; // Cyan Arcs
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00FFFF';
            ctx.shadowBlur = 10;

            // Draw 3-5 random arcs
            const arcCount = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < arcCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 25 + Math.random() * 10;
                const startX = Math.cos(angle) * 15; // Inner
                const startY = Math.sin(angle) * 15;
                const endX = Math.cos(angle) * dist; // Outer
                const endY = Math.sin(angle) * dist;

                // Zigzag path
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
                const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            ctx.restore();
        }

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
        // 1. Draw Merging Lines (Underneath)
        state.enemies.forEach(e => {
            if (e.mergeState === 'warming_up' && e.mergeTimer && !e.mergeHost) {
                // Find host
                const host = state.enemies.find(h => h.mergeId === e.mergeId && h.mergeHost);
                if (host) {
                    ctx.save();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.5 + Math.sin(state.gameTime * 20) * 0.5; // Fast pulse
                    ctx.setLineDash([10, 10]);
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y);
                    ctx.lineTo(host.x, host.y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        });

        enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);

            // Apply Rotation
            if (e.rotationPhase) {
                ctx.rotate(e.rotationPhase);
            }

            // ELITE AURA
            if (e.isElite) {
                ctx.save();
                // Rotate aura opposite to enemy for stability or spin faster
                ctx.rotate(-(e.rotationPhase || 0) * 2);
                ctx.strokeStyle = e.palette[0];
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                // Spiked Halo
                const r = e.size * 1.5;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const ox = Math.cos(angle) * r;
                    const oy = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(ox, oy);
                    else ctx.lineTo(ox, oy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            // Pulse Animation (Breathing effect) - Scale 1.0 to 1.05
            const pulse = 1.0 + (Math.sin(e.pulsePhase || 0) * 0.05);
            ctx.scale(pulse, pulse);

            // Colors from Palette
            let coreColor = e.palette[0];
            let innerColor = e.palette[1];
            let outerColor = e.palette[2];

            // Pentagon Green/Red Pulse
            if (e.shape === 'pentagon') {
                const motherAge = state.gameTime - (e.spawnedAt || 0);
                const isAngry = (e.angryUntil && Date.now() < e.angryUntil);
                const isEnraged = motherAge >= 60;
                const isSuiciding = e.suicideTimer !== undefined;

                if (isSuiciding) {
                    const timeInSuicide = state.gameTime - e.suicideTimer!;
                    const suicideProgress = timeInSuicide / 5.0; // 0 to 1

                    // Increasingly intense red pulse
                    const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2;
                    outerColor = pVal > 0.3 ? '#FF0000' : '#880000';
                    innerColor = pVal > 0.5 ? '#FF5555' : '#440000';

                    // Violent shaking/scaling
                    const suicideScale = 1.0 + (pVal * 0.2 * suicideProgress);
                    ctx.scale(suicideScale, suicideScale);
                } else if (!isAngry && !isEnraged) {
                    const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2; // 0 to 1
                    if (pVal > 0.6) {
                        outerColor = '#4ade80'; // Bright Green
                        innerColor = '#22c55e'; // Medium Green
                    }
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
                    // Minion Shape Logic
                    const isStrong = !!e.stunOnHit;

                    if (isStrong) {
                        // DOUBLE ARROW / LONG BODY (Strong Minion)
                        // Vertices relative to center (0,0)

                        // Extremely elongated for visibility
                        // 1. Front Tip (Longer)
                        const p1 = wp(size * 2.5, 0);
                        // 2. Wing Top
                        const p2 = wp(-size * 1.5, -size * 0.8);
                        // 3. Inner Notch Top
                        const p3 = wp(-size * 0.5, -size * 0.4);
                        // 4. Rear Wing Top
                        const p4 = wp(-size * 2.5, -size * 0.8);
                        // 5. Rear Notch (Center)
                        const p5 = wp(-size * 1.5, 0);
                        // 6. Rear Wing Bottom
                        const p6 = wp(-size * 2.5, size * 0.8);
                        // 7. Inner Notch Bottom
                        const p7 = wp(-size * 0.5, size * 0.4);
                        // 8. Wing Bottom
                        const p8 = wp(-size * 1.5, size * 0.8);

                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.lineTo(p3.x, p3.y);
                        ctx.lineTo(p4.x, p4.y);
                        ctx.lineTo(p5.x, p5.y);
                        ctx.lineTo(p6.x, p6.y);
                        ctx.lineTo(p7.x, p7.y);
                        ctx.lineTo(p8.x, p8.y);
                        ctx.closePath();
                    } else {
                        // STANDARD ARROW (Normal Minion)
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
                    }
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
                    // Triple-Blade Mechanical Wings
                    const bodyR = size * 0.7;

                    // Central Body Core
                    if (warpAmp > 0) {
                        for (let i = 0; i <= 20; i++) {
                            const theta = (i / 20) * Math.PI * 2;
                            const p = wp(Math.cos(theta) * bodyR, Math.sin(theta) * bodyR);
                            if (i === 0) ctx.moveTo(p.x, p.y);
                            else ctx.lineTo(p.x, p.y);
                        }
                    } else {
                        ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
                    }
                    ctx.closePath();

                    // Blade Segment Helper
                    const drawBlade = (side: number, angle: number, lengthMult: number, widthMult: number) => {
                        const start = wp(side * bodyR * 0.8, side * bodyR * angle);
                        const mid = wp(side * size * 2.2 * lengthMult, side * size * (angle + 0.4) * widthMult);
                        const end = wp(side * size * 2.0 * lengthMult, side * size * angle * widthMult);
                        const back = wp(side * bodyR * 0.8, side * bodyR * (angle - 0.2));

                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(mid.x, mid.y);
                        ctx.lineTo(end.x, end.y);
                        ctx.lineTo(back.x, back.y);
                        ctx.closePath();
                    };

                    // Render 3 blades per side
                    // Left 
                    drawBlade(-1, -0.6, 1.0, 1.0); // Top
                    drawBlade(-1, 0, 1.2, 0.5);   // Mid
                    drawBlade(-1, 0.6, 1.0, 1.0);  // Bottom

                    // Right
                    drawBlade(1, -0.6, 1.0, 1.0);  // Top
                    drawBlade(1, 0, 1.2, 0.5);    // Mid
                    drawBlade(1, 0.6, 1.0, 1.0);   // Bottom
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
                        if (v === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }

            // 3. CORE (Darker Center, 50% size)
            ctx.fillStyle = coreColor;
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
            drawShape(e.size * 0.5, true);
            ctx.fill();

            ctx.restore();
        });

        // Diamond Elite Laser Beams (Draw after enemies)
        enemies.forEach(e => {
            if (e.isElite && e.shape === 'diamond' && e.eliteState === 2 &&
                e.lockedTargetX !== undefined && e.lockedTargetY !== undefined) {
                ctx.save();

                // Pulsing laser effect
                const pulse = 0.8 + Math.sin(Date.now() / 50) * 0.2;

                // Draw outer glow
                ctx.strokeStyle = e.palette[1]; // Use era secondary color
                ctx.lineWidth = 8 * pulse;
                ctx.globalAlpha = 0.3;
                ctx.shadowBlur = 20;
                ctx.shadowColor = e.palette[1];
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                // Draw core beam
                ctx.strokeStyle = e.palette[0]; // Use era primary color
                ctx.lineWidth = 4 * pulse;
                ctx.globalAlpha = 0.9;
                ctx.shadowBlur = 10;
                ctx.shadowColor = e.palette[0];
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                // Draw bright center line
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                ctx.restore();
            }
        });


        // Enemy Bullets
        enemyBullets.forEach(b => {
            ctx.fillStyle = b.color || '#ef4444'; // Use projectile color, default red if missing
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Particles
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life < 0.2 ? p.life * 5 : 1; // Fade out

            if (p.type === 'shard') {
                // Draw rotating triangle/shard
                ctx.save();
                ctx.translate(p.x, p.y);
                const rot = state.gameTime * 5 + (p.x * 0.1); // Add some chaos
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.moveTo(p.size * 2, 0);
                ctx.lineTo(-p.size, p.size);
                ctx.lineTo(-p.size, -p.size);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        });

        ctx.restore(); // Restore to screen space for UI indicators

        // --- BOSS OFF-SCREEN INDICATOR (Skull Icon) ---
        enemies.filter(e => e.boss && !e.dead).forEach(e => {
            const scale = 0.58;
            const screenX = (e.x - camera.x) * scale + width / 2;
            const screenY = (e.y - camera.y) * scale + height / 2;

            const pad = 40;
            const isOffscreen = screenX < pad || screenX > width - pad || screenY < pad || screenY > height - pad;

            if (isOffscreen) {
                // Clamp to screen edges
                const ix = Math.max(pad, Math.min(width - pad, screenX));
                const iy = Math.max(pad, Math.min(height - pad, screenY));

                ctx.save();
                ctx.translate(ix, iy);

                // Pulsing Logic
                const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
                ctx.scale(pulse, pulse);

                // Draw Skull Shape
                const drawSkull = (size: number) => {
                    ctx.beginPath();
                    // Face Circle
                    ctx.arc(0, -size * 0.2, size * 0.8, 0, Math.PI * 2);
                    ctx.fill();

                    // Small Jaw Shape below
                    ctx.fillRect(-size * 0.4, size * 0.3, size * 0.8, size * 0.4);

                    // Eyes
                    ctx.fillStyle = '#000000';
                    ctx.beginPath();
                    ctx.arc(-size * 0.3, 0, size * 0.2, 0, Math.PI * 2);
                    ctx.arc(size * 0.3, 0, size * 0.2, 0, Math.PI * 2);
                    ctx.fill();

                    // Nose
                    ctx.beginPath();
                    ctx.moveTo(0, size * 0.2);
                    ctx.lineTo(-size * 0.1, size * 0.4);
                    ctx.lineTo(size * 0.1, size * 0.4);
                    ctx.closePath();
                    ctx.fill();
                };

                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ef4444';
                drawSkull(15);

                ctx.restore();
            }
        });

        // --- FULL-SCREEN SMOKE BLINDNESS EFFECT ---
        if (state.smokeBlindTime !== undefined) {
            const elapsed = state.gameTime - state.smokeBlindTime;
            const fadeIn = 0.3;
            const stay = 2.0;
            const fadeOut = 0.3;
            const total = 2.6;

            if (elapsed < total) {
                let alpha = 0;
                if (elapsed < fadeIn) alpha = elapsed / fadeIn;
                else if (elapsed < fadeIn + stay) alpha = 1;
                else alpha = 1 - (elapsed - (fadeIn + stay)) / fadeOut;

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                // 1. Base Layer (5% peak as requested)
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.05})`;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                // 2. Randomized border clouds (Peak 5% effect)
                for (let i = 0; i < 20; i++) {
                    // Seed removed as it was unused and causing build error

                    let x, y;
                    if (i % 2 === 0) {
                        x = Math.random() * ctx.canvas.width;
                        y = Math.random() < 0.5 ? Math.random() * 150 : ctx.canvas.height - Math.random() * 150;
                    } else {
                        x = Math.random() < 0.5 ? Math.random() * 150 : ctx.canvas.width - Math.random() * 150;
                        y = Math.random() * ctx.canvas.height;
                    }

                    const drift = Math.sin(state.gameTime * 0.5 + i) * 60;
                    const size = 150 + Math.abs(Math.sin(i)) * 250;

                    const grad = ctx.createRadialGradient(x + drift, y + drift, 0, x + drift, y + drift, size);
                    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.1})`);
                    grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                }
                ctx.restore();
            } else {
                state.smokeBlindTime = undefined;
            }
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
    // Restore context if error happened mid-save
    try { ctx.restore(); } catch (e) { }
}
