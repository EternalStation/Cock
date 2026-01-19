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

export function useGameLoop() {
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
    }, [showSettings, showStats]); // Re-bind if blocking state changes

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
    }, []); // Run once - loop checks refs dynamically

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
    // 2. Apply Scale
    ctx.scale(0.8, 0.8);
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

    const cellSize = 8; // Increased from 5.5 for cleaner, more visible honeycomb

    // Helper function to draw a hexagon
    const drawHexagon = (x: number, y: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
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
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt'; // Remove dots at line endpoints for smooth honeycomb
    ctx.lineJoin = 'miter'; // Sharp corners, no dots at vertices
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 15;

    // Draw 7 connected honeycomb cells (no gaps, like real bees)
    // Center cell
    drawHexagon(0, 0, cellSize);

    // 6 surrounding cells - positioned to share edges with center
    const cellDistance = cellSize * Math.sqrt(3); // Perfect honeycomb spacing (no gaps)
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
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

    // Enemies
    enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);

        // Pulse Animation (Breathing effect)
        // const pulse = Math.sin(e.pulsePhase) * 0.15 + 1; 

        // Colors from Palette
        const coreColor = e.palette[0];
        const innerColor = e.palette[1];
        const outerColor = e.palette[2];

        // Shadow/Glow
        ctx.shadowBlur = 10 + (Math.sin(e.pulsePhase) * 5); // Pulsing glow
        ctx.shadowColor = coreColor;

        // --- DRAW SHAPES ---
        // Helper to draw path
        const drawShape = (size: number) => {
            ctx.beginPath();
            if (e.shape === 'circle' || e.shape === 'minion') {
                ctx.arc(0, 0, size, 0, Math.PI * 2);
            } else if (e.shape === 'triangle') {
                ctx.moveTo(0, -size);
                ctx.lineTo(size * 0.866, size * 0.5);
                ctx.lineTo(-size * 0.866, size * 0.5);
                ctx.closePath();
            } else if (e.shape === 'square') {
                ctx.rect(-size / 1.2, -size / 1.2, size * 1.6, size * 1.6);
            } else if (e.shape === 'diamond') {
                ctx.moveTo(0, -size);
                ctx.lineTo(size * 0.8, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size * 0.8, 0);
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
            }
        };

        // --- LAYER 3: OUTER SHELL (Stage 3+) ---
        if (e.shellStage >= 2 || e.boss) {
            ctx.strokeStyle = outerColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            drawShape(e.size + 5);
            ctx.stroke();
        }

        // --- LAYER 2: INNER SHELL OUTLINE (Stage 2+) ---
        if (e.shellStage >= 1 || e.boss) {
            ctx.strokeStyle = innerColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.9;
            drawShape(e.size);
            ctx.stroke();
        }

        // --- BASE BODY (Always Active - Faint Background) ---
        ctx.fillStyle = innerColor;
        ctx.globalAlpha = 0.4; // Faint "not so bright" outer layer
        drawShape(e.size);
        ctx.fill();

        // --- CORE (Always Active - Small & Bright) ---
        ctx.fillStyle = coreColor;
        ctx.globalAlpha = 1;
        drawShape(e.size * 0.5); // "Core less of size"
        ctx.fill();

        // Boss Marker
        if (e.boss) {
            ctx.fillStyle = "#fff";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.fillText("BOSS", 0, -e.size - 10);
        }

        ctx.restore();
    });

    // Bullets
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 5;
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
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
