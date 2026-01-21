import { useRef, useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { createInitialGameState } from '../logic/GameState';
import { updatePlayer } from '../logic/PlayerLogic';
import { updateEnemies } from '../logic/EnemyLogic';
import { updateProjectiles, spawnBullet } from '../logic/ProjectileLogic';
import { updateBossBehavior } from '../logic/BossLogic';
import { spawnUpgrades, applyUpgrade } from '../logic/UpgradeLogic';
import { calcStat } from '../logic/MathUtils';
import { playSfx, startBGM, updateBGMPhase, duckMusic, restoreMusic, pauseMusic, resumeMusic } from '../logic/AudioLogic';
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

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
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

                    state.camera.x = state.player.x;
                    state.camera.y = state.player.y;

                    updateEnemies(state);

                    updateProjectiles(state, (event) => {
                        if (event === 'level_up' || event === 'boss_kill') {
                            const isBoss = (event === 'boss_kill');
                            const choices = spawnUpgrades(state, isBoss);
                            setUpgradeChoices(choices);
                            playSfx('level');
                        }
                        if (event === 'game_over') {
                            setGameOver(true);
                            playSfx('hurt');
                        }
                    });

                    state.enemies.forEach(e => {
                        updateBossBehavior(e, state);
                    });

                    // Shooting Logic
                    const { player } = state;
                    const atkScore = Math.min(9999, calcStat(player.atk));
                    const fireDelay = 200000 / atkScore;

                    if (Date.now() - player.lastShot > fireDelay) {
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

    // Clear
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

    // Draw Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 100;

    // Extend grid bounds significantly to account for zoom (0.8x)
    // Visible area is larger than canvas size, so we buffer by +/- width/height
    const startX = Math.floor((camera.x - width) / gridSize) * gridSize;
    const endX = camera.x + width * 2;
    const startY = Math.floor((camera.y - height) / gridSize) * gridSize;
    const endY = camera.y + height * 2;

    for (let x = startX; x < endX; x += gridSize) {
        ctx.beginPath();
        // Draw full height grid lines
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        // Draw full width grid lines
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }

    // Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
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
        ctx.stroke();
    };

    // Setup style for honeycomb cells
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5; // Slightly thicker for visibility
    ctx.setLineDash([]); // Ensure solid lines
    ctx.lineCap = 'round'; // Smooth corners
    ctx.lineJoin = 'round'; // Smooth joins to prevent "dots" at sharp corners
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 15;

    // Draw 7 connected honeycomb cells (no gaps, like real bees)
    // Center cell
    drawHexagon(0, 0, cellSize);

    // 6 surrounding cells - positioned to share edges with center
    const cellDistance = cellSize * Math.sqrt(3); // Perfect honeycomb spacing (no gaps)
    for (let i = 0; i < 6; i++) {
        // Neighbors at 30, 90, 150... (Edges of flat-topped hex)
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const cx = cellDistance * Math.cos(angle);
        const cy = cellDistance * Math.sin(angle);
        drawHexagon(cx, cy, cellSize);
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
        const coreColor = e.palette[0];
        const innerColor = e.palette[1];
        const outerColor = e.palette[2];

        // GLITCH EFFECT (Fake Snitch)
        if (e.glitchPhase && e.glitchPhase > 0) {
            const jitter = (Math.random() - 0.5) * 10;
            ctx.translate(jitter, -jitter);
            if (Math.random() > 0.8) {
                ctx.globalAlpha = 0.5; // Flicker
            }
        }

        // Shapes Helper
        const drawShape = (size: number) => {
            ctx.beginPath();
            if (e.shape === 'circle' || e.shape === 'minion') {
                ctx.arc(0, 0, size, 0, Math.PI * 2);
            } else if (e.shape === 'triangle') {
                // Equilateral Triangle
                // const h = size * Math.sqrt(3) / 2;
                ctx.moveTo(0, -size);
                ctx.lineTo(size * 0.866, size * 0.5);
                ctx.lineTo(-size * 0.866, size * 0.5);
                ctx.closePath();
            } else if (e.shape === 'square') {
                ctx.rect(-size, -size, size * 2, size * 2);
            } else if (e.shape === 'diamond') {
                ctx.moveTo(0, -size * 1.3);
                ctx.lineTo(size, 0);
                ctx.lineTo(0, size * 1.3);
                ctx.lineTo(-size, 0);
                ctx.closePath();
            } else if (e.shape === 'pentagon') {
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else if (e.shape === 'snitch') {
                // Golden Snitch: Diamond-ish Body + Wings
                // Body
                ctx.moveTo(0, -size);
                ctx.lineTo(size, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size, 0);
                ctx.closePath();

                // Add wings to the path so they get filled/stroked
                // Right Wing
                ctx.moveTo(size, 0);
                ctx.lineTo(size * 2.5, -size * 0.5);
                ctx.lineTo(size * 1.5, size * 0.5);
                ctx.lineTo(size, 0);

                // Left Wing
                ctx.moveTo(-size, 0);
                ctx.lineTo(-size * 2.5, -size * 0.5);
                ctx.lineTo(-size * 1.5, size * 0.5);
                ctx.lineTo(-size, 0);
            }
        };

        // --- VISUAL LAYER SYSTEM ---

        // 1. OUTLINE (Thin glowing ring)
        // Offset 5-10% outward -> size * 1.1
        ctx.strokeStyle = outerColor;
        ctx.lineWidth = 1.5;
        // Subtle glow bloom
        ctx.shadowBlur = 8;
        ctx.shadowColor = outerColor;
        drawShape(e.size * 1.1);
        ctx.stroke();

        // 2. INSIDE LAYER (Remaining 50%)
        // Semi-transparent glow overlay
        // We draw the full size shape, but the Core will cover the inner 50%
        ctx.fillStyle = innerColor;
        // Adjust alpha manually since we only have hex codes
        ctx.globalAlpha = 0.4;
        ctx.shadowBlur = 0; // No blur on fill to save perf/clean look
        drawShape(e.size);
        ctx.fill();

        // 3. CORE (Innermost 50%)
        // Solid bright fill
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 15; // Bright bloom for core
        ctx.shadowColor = coreColor;
        drawShape(e.size * 0.5);
        ctx.fill();

        // Boss Marker
        if (e.boss) {
            ctx.restore(); // Undo rotation/scale for text
            ctx.save();
            ctx.translate(e.x, e.y); // Re-translate
            ctx.fillStyle = "#fff";
            ctx.font = "bold 14px monospace";
            ctx.textAlign = "center";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 3;
            ctx.fillText("BOSS", 0, -e.size - 20);
        }

        ctx.restore();
    });

    // Bullets
    ctx.fillStyle = '#22d3ee'; // Player Color (Cyan)
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 5;
    bullets.forEach(b => {
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

    ctx.restore();
}
